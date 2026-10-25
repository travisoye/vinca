//! WebAssembly worker entrypoint for Vinca protocol inspection.

pub mod state;
pub mod worker_api;

use wasm_bindgen::prelude::*;
use worker_api::{handle_request, WorkerRequest, WorkerResponse};

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
