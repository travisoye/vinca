//! WebAssembly worker entrypoint for Vinca protocol inspection.

pub mod state;
pub mod worker_api;

use wasm_bindgen::prelude::*;
use worker_api::{
    handle_request, scan_compact_blocks as scan_range, WorkerRequest, WorkerResponse,
};
use vinca_core::{Network, PoolKind};

/// Dispatches a raw JSON request from the Web Worker thread into the Rust core.
///
/// Returns a serialized `WorkerResponse` JSON string:
/// `{"status": "ok", "data": ...}` or `{"status": "error", "code": ..., "message": ...}`.
#[wasm_bindgen]
pub fn dispatch_worker_message(request_json: &str) -> String {
    if request_json.len() > 16 * 1024 * 1024 {
        return serialize_error("INPUT_TOO_LARGE", "Worker request exceeds the permitted size.");
    }
    let req: WorkerRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(_) => {
            let res = WorkerResponse::Error {
                code: "DESERIALIZATION_ERROR".into(),
                message: "Malformed worker request JSON.".into(),
            };
            return serde_json::to_string(&res).unwrap_or_else(|_| {
                r#"{"status":"error","code":"CRITICAL","message":"Serialization failed"}"#.into()
            });
        }
    };

    let res = handle_request(req);
    serde_json::to_string(&res).unwrap_or_else(|_| {
        r#"{"status":"error","code":"CRITICAL","message":"Serialization failed"}"#.into()
    })
}

/// Scans binary compact-block data without expanding it into JSON or hex.
#[wasm_bindgen]
pub fn scan_compact_blocks(
    handle: &str,
    start_height: u32,
    end_height: u32,
    compact_blocks: &[u8],
) -> String {
    let response = scan_range(handle, start_height, end_height, compact_blocks);
    serde_json::to_string(&response).unwrap_or_else(|_| {
        r#"{"status":"error","code":"CRITICAL","message":"Serialization failed"}"#.into()
    })
}

/// Decrypts a selected memo directly from bounded full transaction bytes.
#[wasm_bindgen]
pub fn decrypt_transaction_memo(
    handle: &str,
    transaction_bytes: &[u8],
    expected_tx_id_hex: &str,
    block_height: u32,
    network: &str,
    pool: &str,
    action_index: u32,
    expected_amount_zatoshis: &str,
) -> String {
    let network = match network {
        "testnet" => Network::Testnet,
        "regtest" => Network::Regtest,
        _ => {
            return serialize_error(
                "INVALID_NETWORK",
                "Memo inspection supports testnet and regtest only.",
            )
        }
    };
    let pool = match pool {
        "orchard" => PoolKind::Orchard,
        "ironwood" => PoolKind::Ironwood,
        _ => return serialize_error("INVALID_POOL", "Unsupported shielded pool."),
    };
    if transaction_bytes.is_empty() {
        return serialize_error("INVALID_TRANSACTION", "Transaction bytes are empty.");
    }
    if transaction_bytes.len() > vinca_core::MAX_TRANSACTION_BYTES {
        return serialize_error(
            "INPUT_TOO_LARGE",
            "Transaction exceeds the maximum permitted size.",
        );
    }
    let response = handle_request(WorkerRequest::DecryptTransactionMemo {
        handle: handle.to_string(),
        transaction_bytes: transaction_bytes.to_vec(),
        expected_tx_id_hex: expected_tx_id_hex.to_string(),
        block_height,
        network,
        pool,
        action_index,
        expected_amount_zatoshis: expected_amount_zatoshis.to_string(),
    });
    serde_json::to_string(&response).unwrap_or_else(|_| {
        r#"{"status":"error","code":"CRITICAL","message":"Serialization failed"}"#.into()
    })
}

fn serialize_error(code: &str, message: &str) -> String {
    serde_json::to_string(&WorkerResponse::Error {
        code: code.into(),
        message: message.into(),
    })
    .unwrap_or_else(|_| {
        r#"{"status":"error","code":"CRITICAL","message":"Serialization failed"}"#.into()
    })
}
