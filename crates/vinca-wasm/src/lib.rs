//! WebAssembly worker entrypoint for Vinca protocol inspection.

pub mod state;
pub mod worker_api;

use wasm_bindgen::prelude::*;
use worker_api::{handle_request, scan_compact_blocks as scan_range, WorkerRequest, WorkerResponse};

/// Dispatches a raw JSON request from the Web Worker thread into the Rust core.
///
/// Returns a serialized `WorkerResponse` JSON string:
/// `{"status": "ok", "data": ...}` or `{"status": "error", "code": ..., "message": ...}`.
#[wasm_bindgen]
pub fn dispatch_worker_message(request_json: &str) -> String {
    let req: WorkerRequest = match serde_json::from_str(request_json) {
        Ok(r) => r,
        Err(e) => {
            let res = WorkerResponse::Error {
                code: "DESERIALIZATION_ERROR".into(),
                message: format!("Malformed request JSON: {}", e),
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
