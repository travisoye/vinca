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
        CompactAction, CompactReceipt, DecryptedNote, PoolKind, RetainedOrchardKey,
        ScannedReceipt,
    },
};

pub const MAX_ACTIONS_PER_BLOCK: usize = 10_000;
pub const MAX_MEMO_BYTES: usize = 512;
pub const MAX_COMPACT_BLOCK_BYTES: usize = 10 * 1024 * 1024;
pub const MAX_COMPACT_BLOCKS_PER_RANGE: u32 = 1_000;

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

/// Memo decryption remains unavailable until full transactions are parsed and
/// their Orchard output ciphertexts are matched to the selected action.
pub fn decrypt_full_note_memo(
    _retained: &RetainedOrchardKey,
    _ephemeral_key: &[u8; 32],
    _ciphertext_memo: &[u8],
    _nullifier_hex: String,
    _output_index: u32,
    _amount_zatoshis: u64,
) -> Result<DecryptedNote> {
    Err(VincaError::InspectionUnavailable(
        "Full transaction memo decryption is not connected.".into(),
    ))
}

fn prepared_ivk(
    retained: &RetainedOrchardKey,
) -> Result<orchard::keys::PreparedIncomingViewingKey> {
    let mut encoded = [0u8; 64];
    encoded[..32].copy_from_slice(&retained.dk);
    encoded[32..].copy_from_slice(&retained.ivk);
    let incoming = Option::<IncomingViewingKey>::from(IncomingViewingKey::from_bytes(&encoded))
        .ok_or_else(|| {
            VincaError::InvalidEncoding("Invalid Orchard incoming viewing key component".into())
        })?;
    Ok(incoming.prepare())
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
        value::NoteValue,
    };
    use zcash_note_encryption::Domain;

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
}
