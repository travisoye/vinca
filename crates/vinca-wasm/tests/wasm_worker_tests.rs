//! Integration tests for WASM worker message handling and opaque handle lifecycle.
//! Written under validation freeze; execution remains deferred until Phase 9.

use vinca_core::encode_uivk_testnet;
use vinca_wasm::worker_api::{handle_request, WorkerRequest, WorkerResponse};

#[test]
fn test_wasm_worker_decode_and_opaque_handle_lifecycle() {
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
    assert!(matches!(val_res, WorkerResponse::Ok { .. }));

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
    let dk = [0x55u8; 32];
    let ivk = [0x66u8; 32];
    let raw_key = encode_uivk_testnet(&dk, &ivk).expect("Encoding failed");

    let req = WorkerRequest::DecodeKey {
        raw_key,
        network: vinca_core::Network::Testnet,
        label: "Locked Context".into(),
    };
    let res = handle_request(req);
    let handle = match res {
        WorkerResponse::Ok { data } => data.get("handle").unwrap().as_str().unwrap().to_string(),
        _ => panic!("Decode failed"),
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
