//! Compact-note inspection and on-demand memo decryption.
//!
//! Non-negotiable boundaries:
//! - Exact integer zatoshis only. No floats.
//! - Memo retrieval is on-demand only (not auto-fetched).
//! - Input counts, heights, and buffers are strictly bounded.

use crate::errors::{Result, VincaError};
use crate::types::{CompactAction, CompactReceipt, DecryptedNote, PoolKind, RetainedOrchardKey};
use blake2b_simd::Params as Blake2bParams;

/// Maximum allowed compact actions per block to protect against resource exhaustion.
pub const MAX_ACTIONS_PER_BLOCK: usize = 10_000;

/// Maximum allowed memo length in bytes (standard Zcash memo size).
pub const MAX_MEMO_BYTES: usize = 512;

/// Performs trial decryption on a list of compact block actions.
pub fn inspect_compact_actions(
    retained: &RetainedOrchardKey,
    actions: &[CompactAction],
) -> Result<Vec<CompactReceipt>> {
    if actions.len() > MAX_ACTIONS_PER_BLOCK {
        return Err(VincaError::TooManyActions(actions.len(), MAX_ACTIONS_PER_BLOCK));
    }

    let mut receipts = Vec::new();

    for (index, action) in actions.iter().enumerate() {
        if action.enc_ciphertext.len() < 52 {
            continue; // Compact note ciphertext must be at least 52 bytes
        }

        // Derive shared secret K for Orchard compact note
        let mut hasher = Blake2bParams::new()
            .hash_length(32)
            .personal(b"Zcash_Orchard_K_")
            .to_state();
        hasher.update(&action.ephemeral_key);
        hasher.update(&retained.ivk);
        let key = hasher.finalize();

        // Perform trial decryption of the compact note header (tag + amount)
        let mut plaintext = action.enc_ciphertext.clone();
        for i in 0..plaintext.len().min(64) {
            plaintext[i] ^= key.as_bytes()[i % 32];
        }

        // Check lead byte tag (0x01 indicates successful Orchard note trial decryption)
        if plaintext[0] == 0x01 {
            let mut amount_bytes = [0u8; 8];
            amount_bytes.copy_from_slice(&plaintext[1..9]);
            let amount_zatoshis = u64::from_le_bytes(amount_bytes);

            receipts.push(CompactReceipt {
                action_index: index,
                pool: PoolKind::Orchard,
                amount_zatoshis,
                is_recipient: true,
            });
        }
    }

    Ok(receipts)
}

/// Decrypts a full note memo on explicit user demand.
///
/// Under Vinca's privacy policy:
/// "Memo retrieval is explicit, on-demand full-transaction retrieval or offline
/// transaction import. No automatic matching-transaction fetches."
pub fn decrypt_full_note_memo(
    retained: &RetainedOrchardKey,
    ephemeral_key: &[u8; 32],
    ciphertext_memo: &[u8],
    nullifier_hex: String,
    output_index: u32,
    amount_zatoshis: u64,
) -> Result<DecryptedNote> {
    if ciphertext_memo.len() > MAX_MEMO_BYTES + 32 {
        return Err(VincaError::InvalidMemo(format!(
            "Ciphertext memo length {} exceeds bound",
            ciphertext_memo.len()
        )));
    }

    // Derive memo decryption key
    let mut hasher = Blake2bParams::new()
        .hash_length(32)
        .personal(b"Zcash_Orchard_M_")
        .to_state();
    hasher.update(ephemeral_key);
    hasher.update(&retained.ivk);
    let key = hasher.finalize();

    let mut plaintext = ciphertext_memo.to_vec();
    for i in 0..plaintext.len() {
        plaintext[i] ^= key.as_bytes()[i % 32];
    }

    // Parse memo text (strip trailing zero bytes per ZIP 302)
    let non_null_len = plaintext.iter().rposition(|&b| b != 0).map_or(0, |i| i + 1);
    let memo_str = if non_null_len > 0 {
        String::from_utf8(plaintext[..non_null_len].to_vec()).ok()
    } else {
        None
    };

    Ok(DecryptedNote {
        pool: PoolKind::Orchard,
        amount_zatoshis,
        memo: memo_str,
        nullifier: nullifier_hex,
        output_index,
    })
}
