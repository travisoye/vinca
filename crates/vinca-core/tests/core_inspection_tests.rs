//! Unit tests for vinca-core protocol inspection logic.
//! Protocol inspection tests; memo decryption coverage is still in progress.

use vinca_core::{
    compare_orchard_keys, decode_uivk, decrypt_transaction_memo, encode_uivk_testnet,
    inspect_compact_actions, validate_multi_receiver, validate_orchard_receiver,
    CompactAction, Network, OrchardRawReceiver, OverlapKind, PoolKind, RetainedOrchardKey,
    VincaError, MAX_UIVK_INPUT_BYTES,
};
use zcash_address::unified::{Encoding, Ivk, Revision, Uitem, Uivk};
use zcash_protocol::consensus::NetworkType;

#[test]
fn test_valid_uivk_decoding_and_policy() {
    let dk = [0x11u8; 32];
    let ivk = [0x22u8; 32];
    let encoded = encode_uivk_testnet(&dk, &ivk).expect("Encoding failed");
    assert!(encoded.starts_with("uivktest1"));

    let decoded = decode_uivk(
        &encoded,
        Network::Testnet,
        "ctx-test".into(),
        "Testnet Key".into(),
    )
    .expect("Decoding failed");

    assert_eq!(decoded.network, Network::Testnet);
    assert_eq!(decoded.retained_orchard.dk, dk);
    assert_eq!(decoded.retained_orchard.ivk, ivk);
    assert_eq!(decoded.summary.supported_pools, vec![PoolKind::Orchard, PoolKind::Ironwood]);
    assert_eq!(decoded.summary.components.len(), 1);
    assert!(decoded.summary.components[0].retained);
}

#[test]
fn test_revision_two_uivk_decoding() {
    let mut orchard_bytes = [0u8; 64];
    orchard_bytes[..32].fill(0x11);
    orchard_bytes[32..].fill(0x22);
    let encoded = Uivk::try_from_items(
        Revision::R2,
        vec![Uitem::Data(Ivk::Orchard(orchard_bytes))],
    )
    .expect("Building revision 2 UIVK failed")
    .encode(&NetworkType::Test);

    let decoded = decode_uivk(
        &encoded,
        Network::Testnet,
        "ctx-test".into(),
        "Revision 2 key".into(),
    )
    .expect("Revision 2 UIVK should decode");

    assert!(encoded.starts_with("uvitest1"));
    assert_eq!(decoded.retained_orchard.dk, [0x11; 32]);
    assert_eq!(decoded.retained_orchard.ivk, [0x22; 32]);
}

#[test]
fn test_reject_mainnet_hrp() {
    let mainnet_raw = "uivk1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    let result = decode_uivk(mainnet_raw, Network::Testnet, "ctx".into(), "Label".into());
    assert!(matches!(result, Err(VincaError::MainnetRejected(_))));
}

#[test]
fn test_reject_spending_key() {
    let spending_raw = "secret-extended-key-test1qqqqqqqqqqqqqqqqqqqqqqqq";
    let result = decode_uivk(spending_raw, Network::Testnet, "ctx".into(), "Label".into());
    assert!(matches!(result, Err(VincaError::SpendingKeyRejected(_))));
}

#[test]
fn test_reject_ufvk() {
    let ufvk_raw = "uviewtest1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
    let result = decode_uivk(ufvk_raw, Network::Testnet, "ctx".into(), "Label".into());
    assert!(matches!(result, Err(VincaError::FullViewingKeyRejected(_))));
}

#[test]
fn test_reject_oversized_input() {
    let oversized = "a".repeat(MAX_UIVK_INPUT_BYTES + 1);
    let result = decode_uivk(&oversized, Network::Testnet, "ctx".into(), "Label".into());
    assert!(matches!(result, Err(VincaError::InputTooLarge(_, _))));
}

#[test]
fn test_independent_receiver_validation_boundary() {
    let dk = [0x33u8; 32];
    let ivk = [0x44u8; 32];
    let retained = RetainedOrchardKey { dk, ivk };

    // Valid Orchard receiver
    let receiver = OrchardRawReceiver {
        diversifier: [0x01; 11],
        pk_d: [0x55; 32],
    };

    let report = validate_orchard_receiver(&retained, &receiver);
    assert_eq!(report.pool, PoolKind::Orchard);

    // Multi-receiver test: Sapling and transparent must NOT be validated by Orchard IVK
    let multi_reports = validate_multi_receiver(&retained, Some(&receiver), true, true);
    assert_eq!(multi_reports.len(), 3);
    // Sapling and transparent explicitly fail validation
    assert!(!multi_reports[1].matched);
    assert!(!multi_reports[2].matched);
}

#[test]
fn test_overlap_classification() {
    let key_base = RetainedOrchardKey {
        dk: [0x10; 32],
        ivk: [0x20; 32],
    };

    // Identical
    let key_same = RetainedOrchardKey {
        dk: [0x10; 32],
        ivk: [0x20; 32],
    };
    let rep_ident = compare_orchard_keys(&key_base, &key_same);
    assert_eq!(rep_ident.kind, OverlapKind::IdenticalKey);

    // Identical IVK, different DK
    let key_same_ivk = RetainedOrchardKey {
        dk: [0x99; 32],
        ivk: [0x20; 32],
    };
    let rep_same_ivk = compare_orchard_keys(&key_base, &key_same_ivk);
    assert_eq!(rep_same_ivk.kind, OverlapKind::IdenticalDecryptionScalar);

    // Same DK, different IVK
    let key_same_dk = RetainedOrchardKey {
        dk: [0x10; 32],
        ivk: [0x88; 32],
    };
    let rep_same_dk = compare_orchard_keys(&key_base, &key_same_dk);
    assert_eq!(rep_same_dk.kind, OverlapKind::SharedDiversifierKey);

    // Disjoint
    let key_disjoint = RetainedOrchardKey {
        dk: [0xaa; 32],
        ivk: [0xbb; 32],
    };
    let rep_disjoint = compare_orchard_keys(&key_base, &key_disjoint);
    assert_eq!(rep_disjoint.kind, OverlapKind::Disjoint);
}

#[test]
fn test_compact_action_trial_decryption() {
    let retained = RetainedOrchardKey {
        dk: [0x01; 32],
        ivk: [0x02; 32],
    };

    let actions = vec![
        CompactAction {
            nullifier: [0x00; 32],
            cmx: [0x00; 32],
            ephemeral_key: [0x03; 32],
            enc_ciphertext: vec![0u8; 52],
        },
    ];

    let receipts = inspect_compact_actions(&retained, &actions).expect("Trial inspection failed");
    // Since mock ciphertext wasn't encrypted with matching key, lead byte != 0x01, so 0 matching receipts
    assert_eq!(receipts.len(), 0);
}

#[test]
fn test_on_demand_memo_decryption_rejects_malformed_transaction() {
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
        "100000000",
    );

    assert!(matches!(result, Err(VincaError::InvalidTransaction(_))));
}
