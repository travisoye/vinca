//! Integration tests for WASM worker message handling and opaque handle lifecycle.
//! Written under validation freeze; execution remains deferred until Phase 9.

use vinca_core::encode_uivk_testnet;
use vinca_wasm::worker_api::{handle_request, WorkerRequest, WorkerResponse};
use std::sync::Mutex;

static TEST_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn test_wasm_worker_decode_and_opaque_handle_lifecycle() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
    let dk = [0x12u8; 32];
    let ivk = [0x34u8; 32];
    let raw_key = encode_uivk_testnet(&dk, &ivk).expect("Encoding failed");

    // 1. DecodeKey request
    let req = WorkerRequest::DecodeKey {
        raw_key,
        network: vinca_core::Network::Testnet,
        label: "Alpha Context".into(),
    };
    let res = handle_request(req);

    let handle = match res {
        WorkerResponse::Ok { data } => {
            let handle = data.get("handle").and_then(|h| h.as_str()).expect("No handle").to_string();
            assert!(handle.starts_with("vinca-handle-"));
            assert_eq!(data.get("network").and_then(|n| n.as_str()), Some("testnet"));
            handle
        }
        WorkerResponse::Error { code, message } => {
            panic!("Decode failed: [{}] {}", code, message);
        }
    };

    // 2. ValidateReceiver via handle
    let val_req = WorkerRequest::ValidateReceiver {
        handle: handle.clone(),
        diversifier_hex: "0102030405060708090a0b".into(),
        pk_d_hex: "00".repeat(32),
    };
    let val_res = handle_request(val_req);
    match val_res {
        WorkerResponse::Ok { .. } => {}
        WorkerResponse::Error { code, message } => {
            panic!("Receiver validation failed: [{code}] {message}");
        }
    }

    // 3. RevokeHandle
    let revoke_req = WorkerRequest::RevokeHandle {
        handle: handle.clone(),
    };
    let revoke_res = handle_request(revoke_req);
    assert!(matches!(revoke_res, WorkerResponse::Ok { .. }));

    // 4. Query with revoked handle must fail with HANDLE_NOT_FOUND
    let val_after_revoke = WorkerRequest::ValidateReceiver {
        handle,
        diversifier_hex: "0102030405060708090a0b".into(),
        pk_d_hex: "00".repeat(32),
    };
    let after_res = handle_request(val_after_revoke);
    match after_res {
        WorkerResponse::Error { code, .. } => {
            assert_eq!(code, "HANDLE_NOT_FOUND");
        }
        WorkerResponse::Ok { .. } => panic!("Expected HANDLE_NOT_FOUND error"),
    }
}

#[test]
fn test_wasm_worker_lock_workspace_clears_handles() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
    let dk = [0x55u8; 32];
    let ivk = [0x06u8; 32];
    let raw_key = encode_uivk_testnet(&dk, &ivk).expect("Encoding failed");

    let req = WorkerRequest::DecodeKey {
        raw_key,
        network: vinca_core::Network::Testnet,
        label: "Locked Context".into(),
    };
    let res = handle_request(req);
    let handle = match res {
        WorkerResponse::Ok { data } => data.get("handle").unwrap().as_str().unwrap().to_string(),
        WorkerResponse::Error { code, message } => {
            panic!("Decode failed: [{code}] {message}");
        }
    };

    // Lock workspace
    let lock_res = handle_request(WorkerRequest::LockWorkspace);
    assert!(matches!(lock_res, WorkerResponse::Ok { .. }));

    // Handle is no longer valid
    let check_res = handle_request(WorkerRequest::ValidateReceiver {
        handle,
        diversifier_hex: "01".repeat(11),
        pk_d_hex: "02".repeat(32),
    });
    assert!(matches!(check_res, WorkerResponse::Error { code, .. } if code == "HANDLE_NOT_FOUND"));
}

#[test]
fn memo_export_enforces_decoded_handle_network_and_revocation() {
    let _guard = TEST_LOCK.lock().unwrap_or_else(|poison| poison.into_inner());
    let raw_key = encode_uivk_testnet(&[0x12; 32], &[0x34; 32]).unwrap();
    let response = handle_request(WorkerRequest::DecodeKey {
        raw_key,
        network: vinca_core::Network::Testnet,
        label: "Public synthetic memo test".into(),
    });
    let handle = match response {
        WorkerResponse::Ok { data } => data["handle"].as_str().unwrap().to_string(),
        WorkerResponse::Error { code, message } => panic!("{code}: {message}"),
    };

    let wrong_network: serde_json::Value = serde_json::from_str(
        &vinca_wasm::decrypt_transaction_memo(
            &handle, &[0], &"ab".repeat(32), 3_000_000, "regtest", "orchard", 0, "1",
        ),
    ).unwrap();
    assert_eq!(wrong_network["status"], "error");
    assert_eq!(wrong_network["code"], "RECEIPT_MISMATCH");
    assert!(wrong_network["message"].as_str().unwrap().contains("network"));

    handle_request(WorkerRequest::RevokeHandle { handle: handle.clone() });
    let revoked: serde_json::Value = serde_json::from_str(
        &vinca_wasm::decrypt_transaction_memo(
            &handle, &[0], &"ab".repeat(32), 3_000_000, "testnet", "orchard", 0, "1",
        ),
    ).unwrap();
    assert_eq!(revoked["code"], "HANDLE_NOT_FOUND");
}

#[test]
fn memo_export_rejects_empty_oversized_and_unsupported_requests() {
    for (bytes, network, pool, expected_code) in [
        (vec![], "testnet", "orchard", "INVALID_TRANSACTION"),
        (vec![0; vinca_core::MAX_TRANSACTION_BYTES + 1], "testnet", "orchard", "INPUT_TOO_LARGE"),
        (vec![0], "mainnet", "orchard", "INVALID_NETWORK"),
        (vec![0], "testnet", "sapling", "INVALID_POOL"),
    ] {
        let response: serde_json::Value = serde_json::from_str(
            &vinca_wasm::decrypt_transaction_memo(
                "unused", &bytes, &"ab".repeat(32), 3_000_000, network, pool, 0, "1",
            ),
        ).unwrap();
        assert_eq!(response["status"], "error");
        assert_eq!(response["code"], expected_code);
    }
}

#[test]
fn malformed_worker_json_does_not_echo_private_input() {
    let response = vinca_wasm::dispatch_worker_message(
        r#"{"action":"private-key-or-memo-marker","payload":{"raw_key":"private-key-marker"}}"#,
    );
    assert!(!response.contains("private-key"));
    assert!(!response.contains("memo-marker"));
    let parsed: serde_json::Value = serde_json::from_str(&response).unwrap();
    assert_eq!(parsed["code"], "DESERIALIZATION_ERROR");

    let response = handle_request(WorkerRequest::ValidateReceiver {
        handle: "unused".into(),
        diversifier_hex: "\u{00e9}".repeat(11),
        pk_d_hex: "00".repeat(32),
    });
    assert!(matches!(response, WorkerResponse::Error { code, .. } if code == "INVALID_ENCODING"));
}
