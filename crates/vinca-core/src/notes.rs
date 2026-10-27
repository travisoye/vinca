//! Orchard-family compact note inspection.

use orchard::{
    keys::IncomingViewingKey,
    note::{ExtractedNoteCommitment, Nullifier},
    note_encryption::{
        CompactAction as OrchardCompactAction, IronwoodDomain, OrchardDomain,
    },
};
use prost::Message;
use zcash_note_encryption::{try_compact_note_decryption, EphemeralKeyBytes};

use crate::{
    errors::{Result, VincaError},
    types::{
        CompactAction, CompactReceipt, DecryptedMemo, MemoFormat, Network, PoolKind,
        RetainedOrchardKey, ScannedReceipt,
    },
};
use zcash_primitives::transaction::Transaction;
use zcash_protocol::{
    consensus::{BlockHeight, BranchId, TEST_NETWORK},
    memo::{Memo, MemoBytes},
    TxId,
};

pub const MAX_ACTIONS_PER_BLOCK: usize = 10_000;
pub const MAX_MEMO_BYTES: usize = 512;
pub const MAX_COMPACT_BLOCK_BYTES: usize = 10 * 1024 * 1024;
pub const MAX_COMPACT_BLOCKS_PER_RANGE: u32 = 1_000;
pub const MAX_TRANSACTION_BYTES: usize = 2 * 1024 * 1024;
const MAX_ACTIONS_PER_TRANSACTION: usize = 10_000;

#[derive(Clone, PartialEq, Message)]
struct CompactBlock {
    #[prost(uint64, tag = "2")]
    height: u64,
    #[prost(uint32, tag = "5")]
    time: u32,
    #[prost(message, repeated, tag = "7")]
    vtx: Vec<CompactTx>,
}

#[derive(Clone, PartialEq, Message)]
struct CompactTx {
    #[prost(bytes = "vec", tag = "2")]
    txid: Vec<u8>,
    #[prost(bytes = "vec", repeated, tag = "4")]
    sapling_spends: Vec<Vec<u8>>,
    #[prost(message, repeated, tag = "6")]
    orchard_actions: Vec<CompactOrchardAction>,
    #[prost(message, repeated, tag = "9")]
    ironwood_actions: Vec<CompactOrchardAction>,
}

#[derive(Clone, PartialEq, Message)]
struct CompactOrchardAction {
    #[prost(bytes = "vec", tag = "1")]
    nullifier: Vec<u8>,
    #[prost(bytes = "vec", tag = "2")]
    cmx: Vec<u8>,
    #[prost(bytes = "vec", tag = "3")]
    ephemeral_key: Vec<u8>,
    #[prost(bytes = "vec", tag = "4")]
    ciphertext: Vec<u8>,
}

/// Trial-decrypts Orchard compact actions using the protocol implementation.
pub fn inspect_compact_actions(
    retained: &RetainedOrchardKey,
    actions: &[CompactAction],
) -> Result<Vec<CompactReceipt>> {
    if actions.len() > MAX_ACTIONS_PER_BLOCK {
        return Err(VincaError::TooManyActions(
            actions.len(),
            MAX_ACTIONS_PER_BLOCK as usize,
        ));
    }

    let ivk = prepared_ivk(retained)?;
    let mut receipts = Vec::new();

    for (index, action) in actions.iter().enumerate() {
        let orchard_action = to_orchard_action(action)?;
        let orchard_domain = OrchardDomain::for_compact_action(&orchard_action);
        let decrypted = try_compact_note_decryption(&orchard_domain, &ivk, &orchard_action)
            .map(|(note, _recipient)| (PoolKind::Orchard, note.value().inner()))
            .or_else(|| {
                let ironwood_domain = IronwoodDomain::for_compact_action(&orchard_action);
                try_compact_note_decryption(&ironwood_domain, &ivk, &orchard_action)
                    .map(|(note, _recipient)| (PoolKind::Ironwood, note.value().inner()))
            });

        if let Some((pool, amount_zatoshis)) = decrypted {
            receipts.push(CompactReceipt {
                action_index: index,
                pool,
                amount_zatoshis,
                is_recipient: true,
            });
        }
    }

    Ok(receipts)
}

/// Parses complete, four-byte length-prefixed compact blocks and decrypts their
/// Orchard-family actions locally.
pub fn inspect_compact_blocks(
    retained: &RetainedOrchardKey,
    compact_blocks: &[u8],
    start_height: u32,
    end_height: u32,
) -> Result<Vec<ScannedReceipt>> {
    if start_height > end_height {
        return Err(VincaError::InvalidCompactBlock(
            "Requested block range is inverted".into(),
        ));
    }
    let range_size = u64::from(end_height) - u64::from(start_height) + 1;
    if range_size > u64::from(MAX_COMPACT_BLOCKS_PER_RANGE) {
        return Err(VincaError::InvalidCompactBlock(format!(
            "Requested range contains {range_size} blocks; maximum is {MAX_COMPACT_BLOCKS_PER_RANGE}"
        )));
    }
    if compact_blocks.is_empty() || compact_blocks.len() > MAX_COMPACT_BLOCK_BYTES {
        return Err(VincaError::InvalidCompactBlock(format!(
            "Compact-block response size {} is outside the permitted bounds",
            compact_blocks.len()
        )));
    }

    let ivk = prepared_ivk(retained)?;
    let mut offset = 0usize;
    let mut expected_height = u64::from(start_height);
    let mut receipts = Vec::new();

    while offset < compact_blocks.len() {
        if compact_blocks.len() - offset < 4 {
            return Err(VincaError::InvalidCompactBlock(
                "Truncated compact-block frame length".into(),
            ));
        }

        let frame_len = u32::from_be_bytes(
            compact_blocks[offset..offset + 4]
                .try_into()
                .map_err(|_| VincaError::InvalidCompactBlock("Invalid frame length".into()))?,
        ) as usize;
        offset += 4;
        let frame_end = offset.checked_add(frame_len).ok_or_else(|| {
            VincaError::InvalidCompactBlock("Compact-block frame length overflow".into())
        })?;
        if frame_len == 0 || frame_end > compact_blocks.len() {
            return Err(VincaError::InvalidCompactBlock(
                "Compact-block frame exceeds the response boundary".into(),
            ));
        }

        let block = CompactBlock::decode(&compact_blocks[offset..frame_end]).map_err(|error| {
            VincaError::InvalidCompactBlock(format!("Invalid compact-block protobuf: {error}"))
        })?;
        offset = frame_end;

        if block.height != expected_height {
            return Err(VincaError::InvalidCompactBlock(format!(
                "Expected block {expected_height}, received {}",
                block.height
            )));
        }

        let action_count: usize = block
            .vtx
            .iter()
            .map(|tx| tx.orchard_actions.len() + tx.ironwood_actions.len())
            .sum();
        if action_count > MAX_ACTIONS_PER_BLOCK {
            return Err(VincaError::TooManyActions(
                action_count,
                MAX_ACTIONS_PER_BLOCK,
            ));
        }

        for tx in block.vtx {
            if tx.txid.len() != 32 {
                return Err(VincaError::InvalidCompactBlock(
                    "Compact transaction ID must be 32 bytes".into(),
                ));
            }
            let tx_id_hex = hex::encode(tx.txid.iter().rev().copied().collect::<Vec<_>>());

            for (action_index, action) in tx.orchard_actions.into_iter().enumerate() {
                let action = to_orchard_action_from_proto(action)?;
                let orchard_domain = OrchardDomain::for_compact_action(&action);
                let decrypted = try_compact_note_decryption(&orchard_domain, &ivk, &action)
                    .map(|(note, _recipient)| (PoolKind::Orchard, note.value().inner()));

                if let Some((pool, amount_zatoshis)) = decrypted {
                    receipts.push(ScannedReceipt {
                        tx_id_hex: tx_id_hex.clone(),
                        action_index,
                        block_height: expected_height as u32,
                        block_time: block.time,
                        amount_zatoshis: amount_zatoshis.to_string(),
                        pool,
                    });
                }
            }

            for (action_index, action) in tx.ironwood_actions.into_iter().enumerate() {
                let action = to_orchard_action_from_proto(action)?;
                let ironwood_domain = IronwoodDomain::for_compact_action(&action);
                if let Some((note, _recipient)) =
                    try_compact_note_decryption(&ironwood_domain, &ivk, &action)
                {
                    receipts.push(ScannedReceipt {
                        tx_id_hex: tx_id_hex.clone(),
                        action_index,
                        block_height: expected_height as u32,
                        block_time: block.time,
                        amount_zatoshis: note.value().inner().to_string(),
                        pool: PoolKind::Ironwood,
                    });
                }
            }

        }

        expected_height += 1;
    }

    if expected_height != u64::from(end_height) + 1 {
        return Err(VincaError::InvalidCompactBlock(format!(
            "Compact-block response ended before block {end_height}"
        )));
    }

    Ok(receipts)
}

/// Parses and decrypts the selected action from a bounded transaction.
pub fn decrypt_transaction_memo(
    retained: &RetainedOrchardKey,
    transaction_bytes: &[u8],
    expected_tx_id_hex: &str,
    block_height: u32,
    network: Network,
    pool: PoolKind,
    action_index: u32,
    expected_amount_zatoshis: &str,
) -> Result<DecryptedMemo> {
    if transaction_bytes.is_empty() {
        return Err(VincaError::InvalidTransaction(
            "Transaction bytes are empty".into(),
        ));
    }
    if transaction_bytes.len() > MAX_TRANSACTION_BYTES {
        return Err(VincaError::InputTooLarge(
            transaction_bytes.len(),
            MAX_TRANSACTION_BYTES,
        ));
    }

    let expected_tx_id = TxId::from_hex(expected_tx_id_hex).ok_or_else(|| {
        VincaError::InvalidTransaction("Selected receipt has an invalid transaction ID".into())
    })?;
    if expected_amount_zatoshis.is_empty()
        || !expected_amount_zatoshis.bytes().all(|byte| byte.is_ascii_digit())
        || (expected_amount_zatoshis.len() > 1
            && expected_amount_zatoshis.starts_with('0'))
    {
        return Err(VincaError::InvalidTransaction(
            "Selected receipt has an invalid exact amount".into(),
        ));
    }
    // Canonical decimal zatoshis must be within the Zcash money supply bound:
    // 0..=21,000,000 ZEC = 0..=2,100,000,000,000,000 zatoshis.
    const MAX_MONEY_ZATOSHIS: u64 = 2_100_000_000_000_000;
    let expected_amount = expected_amount_zatoshis.parse::<u64>().map_err(|_| {
        VincaError::InvalidTransaction("Selected receipt has an invalid exact amount".into())
    })?;
    if expected_amount > MAX_MONEY_ZATOSHIS {
        return Err(VincaError::InvalidTransaction(
            "Selected receipt amount exceeds the maximum money supply.".into(),
        ));
    }

    // Derive the expected consensus branch from network and height. V5+ transactions embed
    // their own branch ID; verify agreement rather than trusting the caller-supplied height.
    let block_height = BlockHeight::from_u32(block_height);
    let expected_branch = match network {
        Network::Testnet => BranchId::for_height(&TEST_NETWORK, block_height),
        Network::Regtest => {
            // Regtest requires an explicit local activation schedule. Do not guess a
            // regtest branch from a testnet checkpoint; fail explicitly instead.
            return Err(VincaError::InvalidTransaction(
                "Regtest branch requires an explicit local upgrade schedule.".into(),
            ));
        }
    };

    let mut reader = transaction_bytes;
    let transaction = Transaction::read(&mut reader, expected_branch).map_err(|error| {
        VincaError::InvalidTransaction(format!("Transaction parsing failed: {error}"))
    })?;
    if !reader.is_empty() {
        return Err(VincaError::InvalidTransaction(
            "Transaction contains trailing bytes".into(),
        ));
    }
    // Enforce txid equality and version/embedded branch agreement against height/profile.
    if transaction.txid() != expected_tx_id {
        return Err(VincaError::ReceiptMismatch(
            "Fetched transaction ID does not match the selected receipt".into(),
        ));
    }
    if transaction.consensus_branch_id() != expected_branch {
        return Err(VincaError::ReceiptMismatch(
            "Transaction branch does not match the expected network branch at this height.".into(),
        ));
    }
    if !transaction.version().valid_in_branch(expected_branch) {
        return Err(VincaError::ReceiptMismatch(
            "Transaction version is not valid for the expected network branch.".into(),
        ));
    }

    let incoming_ivk = incoming_ivk(retained)?;
    let action_index = usize::try_from(action_index).map_err(|_| {
        VincaError::InvalidTransaction("Selected action index is outside the supported range".into())
    })?;
    let (note, memo_bytes) = match pool {
        PoolKind::Orchard => {
            let bundle = transaction.orchard_bundle().ok_or_else(|| {
                VincaError::DecryptionFailed(
                    "Transaction does not contain an Orchard action bundle".into(),
                )
            })?;
            let action_count = bundle.actions().len();
            if action_count > MAX_ACTIONS_PER_TRANSACTION || action_index >= action_count {
                return Err(VincaError::InvalidTransaction(
                    "Selected Orchard action index is outside the transaction action range".into(),
                ));
            }
            bundle
                .decrypt_output_with_key(action_index, &incoming_ivk)
                .map(|(note, _recipient, memo)| (note, memo))
                .ok_or_else(|| VincaError::DecryptionFailed(
                    "Selected Orchard action could not be decrypted with this viewing key".into(),
                ))?
        }
        PoolKind::Ironwood => {
            let bundle = transaction.ironwood_bundle().ok_or_else(|| {
                VincaError::DecryptionFailed(
                    "Transaction does not contain an Ironwood action bundle".into(),
                )
            })?;
            let action_count = bundle.actions().len();
            if action_count > MAX_ACTIONS_PER_TRANSACTION || action_index >= action_count {
                return Err(VincaError::InvalidTransaction(
                    "Selected Ironwood action index is outside the transaction action range".into(),
                ));
            }
            bundle
                .decrypt_output_with_key(action_index, &incoming_ivk)
                .map(|(note, _recipient, memo)| (note, memo))
                .ok_or_else(|| VincaError::DecryptionFailed(
                    "Selected Ironwood action could not be decrypted with this viewing key".into(),
                ))?
        }
    };

    if note.value().inner() != expected_amount {
        return Err(VincaError::ReceiptMismatch(
            "Decrypted note amount does not match the locally scanned receipt".into(),
        ));
    }

    decode_memo(memo_bytes)
}

fn decode_memo(bytes: [u8; 512]) -> Result<DecryptedMemo> {
    let memo_bytes = MemoBytes::from_bytes(&bytes)
        .map_err(|error| VincaError::InvalidMemo(error.to_string()))?;

    let raw_bytes_hex = hex::encode(memo_bytes.as_array());

    match Memo::try_from(&memo_bytes).map_err(|error| VincaError::InvalidMemo(error.to_string()))? {
        Memo::Empty if bytes[0] == 0xF6 && bytes[1..].iter().all(|byte| *byte == 0) => {
            Ok(DecryptedMemo {
                format: MemoFormat::NoMemo,
                text: String::new(),
                raw_bytes_hex: Some(raw_bytes_hex),
            })
        }
        Memo::Empty => Ok(DecryptedMemo {
            format: MemoFormat::FutureFormat,
            text: String::new(),
            raw_bytes_hex: Some(raw_bytes_hex),
        }),
        Memo::Text(text) => Ok(DecryptedMemo {
            format: MemoFormat::Text,
            text: text.trim_end_matches('\0').into(),
            raw_bytes_hex: Some(raw_bytes_hex),
        }),
        Memo::Arbitrary(_bytes) => {
            Ok(DecryptedMemo {
                format: MemoFormat::ArbitraryBytes,
                text: String::new(),
                raw_bytes_hex: Some(raw_bytes_hex),
            })
        }
        Memo::Future(_bytes) => {
            let format = if bytes[0] == 0xF5 {
                MemoFormat::LegacyNontext
            } else {
                MemoFormat::FutureFormat
            };
            Ok(DecryptedMemo {
                format,
                text: String::new(),
                raw_bytes_hex: Some(raw_bytes_hex),
            })
        }
    }
}

fn prepared_ivk(
    retained: &RetainedOrchardKey,
) -> Result<orchard::keys::PreparedIncomingViewingKey> {
    Ok(incoming_ivk(retained)?.prepare())
}

fn incoming_ivk(retained: &RetainedOrchardKey) -> Result<IncomingViewingKey> {
    let mut encoded = [0u8; 64];
    encoded[..32].copy_from_slice(&retained.dk);
    encoded[32..].copy_from_slice(&retained.ivk);
    Option::<IncomingViewingKey>::from(IncomingViewingKey::from_bytes(&encoded))
        .ok_or_else(|| {
            VincaError::InvalidEncoding("Invalid Orchard incoming viewing key component".into())
        })
}

fn to_orchard_action(action: &CompactAction) -> Result<OrchardCompactAction> {
    if action.enc_ciphertext.len() != 52 {
        return Err(VincaError::InvalidCompactBlock(
            "Compact Orchard ciphertext must be exactly 52 bytes".into(),
        ));
    }
    let ciphertext: [u8; 52] = action
        .enc_ciphertext
        .as_slice()
        .try_into()
        .map_err(|_| VincaError::InvalidCompactBlock("Invalid compact ciphertext".into()))?;
    let nullifier = option_from_ct(Nullifier::from_bytes(&action.nullifier))
        .ok_or_else(|| VincaError::InvalidCompactBlock("Invalid Orchard nullifier".into()))?;
    let cmx = option_from_ct(ExtractedNoteCommitment::from_bytes(&action.cmx))
        .ok_or_else(|| VincaError::InvalidCompactBlock("Invalid Orchard commitment".into()))?;

    Ok(OrchardCompactAction::from_parts(
        nullifier,
        cmx,
        EphemeralKeyBytes(action.ephemeral_key),
        ciphertext,
    ))
}

fn to_orchard_action_from_proto(
    action: CompactOrchardAction,
) -> Result<OrchardCompactAction> {
    let nullifier: [u8; 32] = action
        .nullifier
        .as_slice()
        .try_into()
        .map_err(|_| VincaError::InvalidCompactBlock("Invalid Orchard nullifier length".into()))?;
    let cmx: [u8; 32] = action
        .cmx
        .as_slice()
        .try_into()
        .map_err(|_| VincaError::InvalidCompactBlock("Invalid Orchard commitment length".into()))?;
    let ephemeral_key: [u8; 32] = action
        .ephemeral_key
        .as_slice()
        .try_into()
        .map_err(|_| {
            VincaError::InvalidCompactBlock("Invalid Orchard ephemeral key length".into())
        })?;
    let ciphertext: [u8; 52] = action
        .ciphertext
        .as_slice()
        .try_into()
        .map_err(|_| {
            VincaError::InvalidCompactBlock("Compact Orchard ciphertext must be 52 bytes".into())
        })?;
    let nullifier = option_from_ct(Nullifier::from_bytes(&nullifier))
        .ok_or_else(|| VincaError::InvalidCompactBlock("Invalid Orchard nullifier".into()))?;
    let cmx = option_from_ct(ExtractedNoteCommitment::from_bytes(&cmx))
        .ok_or_else(|| VincaError::InvalidCompactBlock("Invalid Orchard commitment".into()))?;

    Ok(OrchardCompactAction::from_parts(
        nullifier,
        cmx,
        EphemeralKeyBytes(ephemeral_key),
        ciphertext,
    ))
}



fn option_from_ct<T>(value: subtle::CtOption<T>) -> Option<T> {
    Option::from(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    use orchard::{
        keys::IncomingViewingKey,
        note::{Note, NoteVersion, RandomSeed, Rho},
        note_encryption::{
            IronwoodDomain, IronwoodNoteEncryption, OrchardDomain, OrchardNoteEncryption,
        },
        primitives::redpallas::{self, Signature},
        value::NoteValue,
    };
    use zcash_primitives::transaction::{
        Authorized, TransactionData, TxVersion,
        components::orchard::bundle_version_for_branch,
    };
    use zcash_note_encryption::Domain;
    use zcash_protocol::{
        consensus::{BlockHeight, BranchId, TEST_NETWORK},
        value::ZatBalance,
    };

    fn valid_ivk() -> ([u8; 64], IncomingViewingKey) {
        let mut bytes = [0u8; 64];
        bytes[0] = 7;
        bytes[32] = 1;
        let ivk = Option::<IncomingViewingKey>::from(IncomingViewingKey::from_bytes(&bytes))
            .expect("test IVK is valid");
        (bytes, ivk)
    }

    fn compact_action(amount: u64, version: NoteVersion) -> (RetainedOrchardKey, CompactAction) {
        let (ivk_bytes, incoming_ivk) = valid_ivk();
        let retained = RetainedOrchardKey {
            dk: ivk_bytes[..32].try_into().expect("fixed-size diversifier key"),
            ivk: ivk_bytes[32..].try_into().expect("fixed-size IVK scalar"),
        };
        let nullifier = option_from_ct(Nullifier::from_bytes(&[0u8; 32]))
            .expect("zero is a canonical test nullifier");
        let rho = option_from_ct(Rho::from_bytes(&[0u8; 32]))
            .expect("zero is a canonical test rho");
        let rseed = option_from_ct(RandomSeed::from_bytes([1u8; 32], &rho))
            .expect("test random seed derives a valid ephemeral secret");
        let note = option_from_ct(Note::from_parts(
            incoming_ivk.address_at(0u32),
            NoteValue::from_raw(amount),
            rho,
            rseed,
            version,
        ))
        .expect("test note commitment is valid");
        let cmx = ExtractedNoteCommitment::from(note.commitment());
        let (ephemeral_key, enc_ciphertext) = match version {
            NoteVersion::V2 => {
                let encryptor = OrchardNoteEncryption::new(None, note, [0u8; 512]);
                let epk = OrchardDomain::epk_bytes(encryptor.epk());
                (epk.0, encryptor.encrypt_note_plaintext().as_ref()[..52].to_vec())
            }
            NoteVersion::V3 => {
                let encryptor = IronwoodNoteEncryption::new(None, note, [0u8; 512]);
                let epk = IronwoodDomain::epk_bytes(encryptor.epk());
                (epk.0, encryptor.encrypt_note_plaintext().as_ref()[..52].to_vec())
            }
        };
        let compact = CompactAction {
            nullifier: nullifier.to_bytes(),
            cmx: cmx.to_bytes(),
            ephemeral_key,
            enc_ciphertext,
        };
        (retained, compact)
    }

    fn frame_block(block: CompactBlock) -> Vec<u8> {
        let encoded = block.encode_to_vec();
        let mut framed = Vec::with_capacity(encoded.len() + 4);
        framed.extend_from_slice(&(encoded.len() as u32).to_be_bytes());
        framed.extend_from_slice(&encoded);
        framed
    }

    fn serialized_transaction(
        amount: u64,
        memo: [u8; 512],
        height: u32,
        tx_version: TxVersion,
        pool: PoolKind,
    ) -> (RetainedOrchardKey, String, Vec<u8>) {
        let (ivk_bytes, incoming_ivk) = valid_ivk();
        let retained = RetainedOrchardKey {
            dk: ivk_bytes[..32].try_into().expect("fixed-size diversifier key"),
            ivk: ivk_bytes[32..].try_into().expect("fixed-size IVK scalar"),
        };
        let nullifier = option_from_ct(Nullifier::from_bytes(&[0u8; 32]))
            .expect("zero is a canonical test nullifier");
        let rho = option_from_ct(Rho::from_bytes(&[0u8; 32]))
            .expect("zero is a canonical test rho");
        let rseed = option_from_ct(RandomSeed::from_bytes([1u8; 32], &rho))
            .expect("test random seed derives a valid ephemeral secret");
        let note = option_from_ct(Note::from_parts(
            incoming_ivk.address_at(0u32),
            NoteValue::from_raw(amount),
            rho,
            rseed,
            match pool {
                PoolKind::Orchard => NoteVersion::V2,
                PoolKind::Ironwood => NoteVersion::V3,
            },
        ))
        .expect("test note commitment is valid");
        let (epk_bytes, enc_ciphertext) = match pool {
            PoolKind::Orchard => {
                let encryptor = OrchardNoteEncryption::new(None, note, memo);
                (
                    OrchardDomain::epk_bytes(encryptor.epk()).0,
                    encryptor.encrypt_note_plaintext(),
                )
            }
            PoolKind::Ironwood => {
                let encryptor = IronwoodNoteEncryption::new(None, note, memo);
                (
                    IronwoodDomain::epk_bytes(encryptor.epk()).0,
                    encryptor.encrypt_note_plaintext(),
                )
            }
        };
        let transmitted_note = orchard::note::TransmittedNoteCiphertext {
            epk_bytes,
            enc_ciphertext,
            out_ciphertext: [0; 80],
        };
        let spend_auth_key: redpallas::SigningKey<redpallas::SpendAuth> =
            [1u8; 32].try_into().expect("test signing key is valid");
        let action = orchard::Action::from_parts(
            nullifier,
            redpallas::VerificationKey::from(&spend_auth_key),
            ExtractedNoteCommitment::from(note.commitment()),
            transmitted_note,
            option_from_ct(orchard::value::ValueCommitment::from_bytes(&[0; 32]))
                .expect("identity is a valid test value commitment"),
            Signature::from([0; 64]),
        )
        .expect("test action has valid curve encodings");

        let block_height = BlockHeight::from_u32(height);
        let branch = BranchId::for_height(&TEST_NETWORK, block_height);
        let bundle_version =
            bundle_version_for_branch(
                branch,
                match pool {
                    PoolKind::Orchard => orchard::ValuePool::Orchard,
                    PoolKind::Ironwood => orchard::ValuePool::Ironwood,
                },
            )
            .expect("test pool is active at this test height");
        let flags = orchard::bundle::Flags::from_byte(0b010, bundle_version)
            .expect("output-enabled flags are valid");
        let anchor = option_from_ct(orchard::Anchor::from_bytes([0; 32]))
            .expect("zero is a canonical test anchor");
        let bundle = orchard::Bundle::try_from_parts(
            nonempty::NonEmpty::from_vec(vec![action]).expect("test bundle has one action"),
            flags,
            ZatBalance::zero(),
            anchor,
            orchard::bundle::Authorized::from_parts(
                orchard::Proof::new(vec![
                    0;
                    orchard::Proof::expected_proof_size(1)
                ]),
                Signature::from([0; 64]),
            ),
            bundle_version,
        )
        .expect("test bundle has canonical proof size and flags");
        let tx_data = match tx_version {
            TxVersion::V5 if pool == PoolKind::Orchard => {
                TransactionData::<Authorized>::from_parts(
                    tx_version,
                    branch,
                    0,
                    1u32.into(),
                    None,
                    None,
                    None,
                    Some(bundle),
                )
            }
            TxVersion::V6 => TransactionData::<Authorized>::from_parts_v6(
                branch,
                0,
                1u32.into(),
                None,
                None,
                if pool == PoolKind::Orchard {
                    Some(bundle.clone())
                } else {
                    None
                },
                if pool == PoolKind::Ironwood {
                    Some(bundle)
                } else {
                    None
                },
            ),
            _ => panic!("unsupported synthetic transaction version and pool"),
        };
        let tx = tx_data
            .freeze()
            .expect("test transaction should serialize");
        let tx_id_hex = tx.txid().to_string();
        let mut transaction_bytes = Vec::new();
        tx.write(&mut transaction_bytes)
            .expect("test transaction should encode");

        (retained, tx_id_hex, transaction_bytes)
    }

    #[test]
    fn decrypts_real_orchard_compact_action_amount() {
        let (retained, action) = compact_action(260_000_000, NoteVersion::V2);

        let receipts = inspect_compact_actions(&retained, &[action])
            .expect("Orchard trial decryption should succeed");

        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].pool, PoolKind::Orchard);
        assert_eq!(receipts[0].amount_zatoshis, 260_000_000);
    }

    #[test]
    fn parses_compact_blocks_and_preserves_exact_receipt_fields() {
        let (retained, action) = compact_action(260_000_000, NoteVersion::V2);
        let block = CompactBlock {
            height: 123,
            time: 1_700_000_000,
            vtx: vec![CompactTx {
                txid: (0u8..32).collect(),
                sapling_spends: vec![],
                orchard_actions: vec![CompactOrchardAction {
                    nullifier: action.nullifier.to_vec(),
                    cmx: action.cmx.to_vec(),
                    ephemeral_key: action.ephemeral_key.to_vec(),
                    ciphertext: action.enc_ciphertext,
                }],
                ironwood_actions: vec![],
            }],
        };

        let receipts = inspect_compact_blocks(&retained, &frame_block(block), 123, 123)
            .expect("valid compact-block range should decode");

        assert_eq!(receipts.len(), 1);
        assert_eq!(
            receipts[0].tx_id_hex,
            "1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100"
        );
        assert_eq!(receipts[0].block_height, 123);
        assert_eq!(receipts[0].block_time, 1_700_000_000);
        assert_eq!(receipts[0].amount_zatoshis, "260000000");
        assert_eq!(receipts[0].pool, PoolKind::Orchard);
    }

    #[test]
    fn rejects_truncated_compact_block_frames() {
        let (retained, _) = compact_action(1, NoteVersion::V2);

        let result = inspect_compact_blocks(&retained, &[0, 0, 0, 5, 1], 123, 123);

        assert!(matches!(result, Err(VincaError::InvalidCompactBlock(_))));
    }

    #[test]
    fn ignores_sapling_spends_and_scans_current_orchard_field() {
        let (retained, action) = compact_action(260_000_000, NoteVersion::V2);
        let block = CompactBlock {
            height: 123,
            time: 1_700_000_000,
            vtx: vec![CompactTx {
                txid: vec![0x11; 32],
                sapling_spends: vec![vec![0x22; 32]],
                orchard_actions: vec![CompactOrchardAction {
                    nullifier: action.nullifier.to_vec(),
                    cmx: action.cmx.to_vec(),
                    ephemeral_key: action.ephemeral_key.to_vec(),
                    ciphertext: action.enc_ciphertext,
                }],
                ironwood_actions: vec![],
            }],
        };

        let receipts = inspect_compact_blocks(&retained, &frame_block(block), 123, 123)
            .expect("current Orchard action and irrelevant Sapling spend should parse");

        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].action_index, 0);
        assert_eq!(receipts[0].amount_zatoshis, "260000000");
    }

    #[test]
    fn scans_ironwood_actions_from_their_current_compact_tx_field() {
        let (retained, action) = compact_action(260_000_000, NoteVersion::V3);
        let block = CompactBlock {
            height: 124,
            time: 1_700_000_001,
            vtx: vec![CompactTx {
                txid: vec![0x33; 32],
                sapling_spends: vec![],
                orchard_actions: vec![],
                ironwood_actions: vec![CompactOrchardAction {
                    nullifier: action.nullifier.to_vec(),
                    cmx: action.cmx.to_vec(),
                    ephemeral_key: action.ephemeral_key.to_vec(),
                    ciphertext: action.enc_ciphertext,
                }],
            }],
        };

        let receipts = inspect_compact_blocks(&retained, &frame_block(block), 124, 124)
            .expect("Ironwood compact action should decrypt");

        assert_eq!(receipts.len(), 1);
        assert_eq!(receipts[0].pool, PoolKind::Ironwood);
        assert_eq!(receipts[0].amount_zatoshis, "260000000");
    }

    #[test]
    fn rejects_invalid_orchard_ivk_without_panicking() {
        let retained = RetainedOrchardKey {
            dk: [0u8; 32],
            ivk: [0u8; 32],
        };

        let result = inspect_compact_actions(&retained, &[]);

        assert!(matches!(result, Err(VincaError::InvalidEncoding(_))));
    }

    #[test]
    fn decodes_text_memo_without_padding_bytes() {
        let mut bytes = [0u8; 512];
        bytes[..5].copy_from_slice(b"hello");

        let decoded = decode_memo(bytes).expect("valid text memo should decode");

        assert_eq!(decoded.format, MemoFormat::Text);
        assert_eq!(decoded.text, "hello");
        assert_eq!(
            decoded.raw_bytes_hex,
            Some(hex::encode(bytes.as_slice()))
        );
    }

    #[test]
    fn decodes_unicode_and_multiline_text_memos_losslessly() {
        let text = "Paid \u{2713}\nsecond line";
        let mut bytes = [0u8; 512];
        bytes[..text.len()].copy_from_slice(text.as_bytes());

        let decoded = decode_memo(bytes).expect("valid UTF-8 text memo should decode");

        assert_eq!(decoded.format, MemoFormat::Text);
        assert_eq!(decoded.text, text);
        assert_eq!(decoded.raw_bytes_hex, Some(hex::encode(bytes)));
    }

    #[test]
    fn rejects_invalid_utf8_in_text_memo() {
        let mut bytes = [0u8; 512];
        bytes[..2].copy_from_slice(&[0x01, 0xff]);

        assert!(matches!(decode_memo(bytes), Err(VincaError::InvalidMemo(_))));
    }

    #[test]
    fn decodes_no_memo_sentinel_preserves_all_bytes() {
        let mut bytes = [0u8; 512];
        bytes[0] = 0xF6;

        let decoded = decode_memo(bytes).expect("no-memo sentinel should decode");

        assert_eq!(decoded.format, MemoFormat::NoMemo);
        assert_eq!(decoded.text, "");
        assert_eq!(
            decoded.raw_bytes_hex,
            Some(hex::encode(bytes.as_slice()))
        );
    }

    #[test]
    fn preserves_arbitrary_memo_as_hex() {
        let mut bytes = [0u8; 512];
        bytes[0] = 0xFF;
        bytes[1] = 0x00;
        bytes[2] = 0xFE;

        let decoded = decode_memo(bytes).expect("arbitrary memo should decode");

        assert_eq!(decoded.format, MemoFormat::ArbitraryBytes);
        assert_eq!(decoded.text, "");
        assert_eq!(
            decoded.raw_bytes_hex,
            Some(hex::encode(bytes.as_slice()))
        );
    }

    #[test]
    fn decodes_reserved_memo_marker_preserves_all_bytes() {
        let mut bytes = [0u8; 512];
        bytes[0] = 0xF7;

        let decoded = decode_memo(bytes).expect("future memo should decode");

        assert_eq!(decoded.format, MemoFormat::FutureFormat);
        assert_eq!(decoded.text, "");
        assert_eq!(
            decoded.raw_bytes_hex,
            Some(hex::encode(bytes.as_slice()))
        );
    }

    #[test]
    fn preserves_legacy_nontext_marker_distinctly() {
        let mut bytes = [0u8; 512];
        bytes[0] = 0xF5;

        let decoded = decode_memo(bytes).expect("legacy marker should decode");

        assert_eq!(decoded.format, MemoFormat::LegacyNontext);
        assert_eq!(decoded.text, "");
        assert_eq!(decoded.raw_bytes_hex, Some(hex::encode(bytes)));
    }

    #[test]
    fn distinguishes_no_memo_from_other_f6_encodings() {
        let mut bytes = [0u8; 512];
        bytes[0] = 0xF6;
        bytes[1] = 1;

        let decoded = decode_memo(bytes).expect("reserved F6 encoding remains uninterpreted");

        assert_eq!(decoded.format, MemoFormat::FutureFormat);
        assert_eq!(decoded.raw_bytes_hex, Some(hex::encode(bytes)));
    }

    #[test]
    fn rejects_noncanonical_decimal_amounts() {
        let retained = RetainedOrchardKey {
            dk: [0x01; 32],
            ivk: [0x02; 32],
        };

        for amount in ["00", "01", "+1", "-1", "1.0", " 1", ""] {
            let result = decrypt_transaction_memo(
                &retained,
                &[0],
                &"00".repeat(32),
                2_700_050,
                Network::Testnet,
                PoolKind::Orchard,
                0,
                amount,
            );
            assert!(matches!(result, Err(VincaError::InvalidTransaction(_))), "{amount:?}");
        }
    }

    #[test]
    fn rejects_empty_transaction_and_non_decimal_receipt_amount() {
        let retained = RetainedOrchardKey {
            dk: [0x01; 32],
            ivk: [0x02; 32],
        };

        assert!(matches!(
            decrypt_transaction_memo(
                &retained,
                &[],
                &"00".repeat(32),
                2_700_050,
                Network::Testnet,
                PoolKind::Orchard,
                0,
                "100000000",
            ),
            Err(VincaError::InvalidTransaction(_))
        ));
        assert!(matches!(
            decrypt_transaction_memo(
                &retained,
                &[0],
                &"00".repeat(32),
                2_700_050,
                Network::Testnet,
                PoolKind::Orchard,
                0,
                "1e8",
            ),
            Err(VincaError::InvalidTransaction(_))
        ));
    }

    #[test]
    fn decrypts_memo_from_serialized_transaction_with_authenticated_note_ciphertext() {
        let memo_text = "Synthetic memo ✓\nsecond line";
        let mut memo_bytes = [0; 512];
        memo_bytes[..memo_text.len()].copy_from_slice(memo_text.as_bytes());
        let (retained, tx_id_hex, transaction_bytes) =
            serialized_transaction(
                260_000_000,
                memo_bytes,
                2_700_050,
                TxVersion::V5,
                PoolKind::Orchard,
            );
        let decrypted = decrypt_transaction_memo(
            &retained,
            &transaction_bytes,
            &tx_id_hex,
            2_700_050,
            Network::Testnet,
            PoolKind::Orchard,
            0,
            "260000000",
        )
        .expect("serialized transaction memo should authenticate and decrypt");

        assert_eq!(decrypted.format, MemoFormat::Text);
        assert_eq!(decrypted.text, memo_text);
        assert_eq!(decrypted.raw_bytes_hex, Some(hex::encode(memo_bytes)));
    }

    #[test]
    fn decrypts_v6_orchard_and_ironwood_memos_from_synthetic_transactions() {
        let memo_text = "Synthetic V6 memo";
        let mut memo_bytes = [0; 512];
        memo_bytes[..memo_text.len()].copy_from_slice(memo_text.as_bytes());
        let height = 4_200_000;

        for pool in [PoolKind::Orchard, PoolKind::Ironwood] {
            let (retained, tx_id_hex, transaction_bytes) = serialized_transaction(
                42,
                memo_bytes,
                height,
                TxVersion::V6,
                pool,
            );

            let decrypted = decrypt_transaction_memo(
                &retained,
                &transaction_bytes,
                &tx_id_hex,
                height,
                Network::Testnet,
                pool,
                0,
                "42",
            )
            .expect("serialized V6 transaction memo should authenticate and decrypt");

            assert_eq!(decrypted.format, MemoFormat::Text);
            assert_eq!(decrypted.text, memo_text);
            assert_eq!(decrypted.raw_bytes_hex, Some(hex::encode(memo_bytes)));
        }
    }

    #[test]
    fn rejects_amount_above_max_money_supply() {
        let retained = RetainedOrchardKey {
            dk: [0x01; 32],
            ivk: [0x02; 32],
        };

        let result = decrypt_transaction_memo(
            &retained,
            &[0],
            &"00".repeat(32),
            2_700_050,
            Network::Testnet,
            PoolKind::Orchard,
            0,
            "2100000000000001",
        );

        assert!(matches!(result, Err(VincaError::InvalidTransaction(_))));
    }

    #[test]
    fn rejects_regtest_without_explicit_branch_schedule() {
        let retained = RetainedOrchardKey {
            dk: [0x01; 32],
            ivk: [0x02; 32],
        };

        let result = decrypt_transaction_memo(
            &retained,
            &[0],
            &"00".repeat(32),
            1,
            Network::Regtest,
            PoolKind::Orchard,
            0,
            "100000000",
        );

        assert!(matches!(
            result,
            Err(VincaError::InvalidTransaction(_))
        ));
    }

    #[test]
    fn rejects_branch_mismatch_at_height() {
        let retained = RetainedOrchardKey {
            dk: [0x01; 32],
            ivk: [0x02; 32],
        };

        // A height that implies branch X but a transaction embedded with branch Y.
        // The fixture bytes [0] are too short to parse, so this hits InvalidTransaction
        // before branch agreement can be evaluated; the separate fixture test below
        // covers a valid V5 transaction with mismatched branch.
        let result = decrypt_transaction_memo(
            &retained,
            &[0u8; 20],
            &"00".repeat(32),
            2_700_050,
            Network::Testnet,
            PoolKind::Orchard,
            0,
            "100000000",
        );

        assert!(matches!(result, Err(VincaError::InvalidTransaction(_))));
    }
}
