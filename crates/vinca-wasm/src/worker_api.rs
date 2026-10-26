//! Typed worker communication protocol for WebAssembly bindings.

use crate::state::{clear_all_keys, revoke_key, store_key, with_key};
use serde::{Deserialize, Serialize};
use vinca_core::{
    compare_orchard_keys, decode_uivk, decrypt_transaction_memo, inspect_compact_actions,
    inspect_compact_blocks, validate_orchard_receiver, CompactAction, Network, OrchardRawReceiver,
    PoolKind, VincaError, MAX_TRANSACTION_BYTES,
};

/// Incoming worker request message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action", content = "payload", rename_all = "snake_case")]
pub enum WorkerRequest {
    DecodeKey {
        raw_key: String,
        network: Network,
        label: String,
    },
    ValidateReceiver {
        handle: String,
        diversifier_hex: String,
        pk_d_hex: String,
    },
    CompareContexts {
        handle_a: String,
        handle_b: String,
    },
    InspectCompactActions {
        handle: String,
        actions: Vec<CompactAction>,
    },
    DecryptTransactionMemo {
        handle: String,
        transaction_bytes: Vec<u8>,
        expected_tx_id_hex: String,
        block_height: u32,
        network: Network,
        pool: PoolKind,
        action_index: u32,
        expected_amount_zatoshis: String,
    },
    RevokeHandle {
        handle: String,
    },
    LockWorkspace,
}

/// Outgoing worker response message.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum WorkerResponse {
    Ok {
        data: serde_json::Value,
    },
    Error {
        code: String,
        message: String,
    },
}

#[derive(Debug, Serialize)]
struct DecodedKeyResult {
    handle: String,
    network: Network,
    retained_pools: Vec<PoolKind>,
    declared_unretained: Vec<String>,
}

impl WorkerResponse {
    pub fn success<T: Serialize>(val: &T) -> Self {
        match serde_json::to_value(val) {
            Ok(data) => WorkerResponse::Ok { data },
            Err(e) => WorkerResponse::Error {
                code: "SERIALIZATION_ERROR".into(),
                message: e.to_string(),
            },
        }
    }

    pub fn err(err: VincaError) -> Self {
        let code = match &err {
            VincaError::MainnetRejected(_) => "MAINNET_REJECTED",
            VincaError::SpendingKeyRejected(_) => "SPENDING_KEY_REJECTED",
            VincaError::FullViewingKeyRejected(_) => "UFVK_REJECTED",
            VincaError::InputTooLarge(_, _) => "INPUT_TOO_LARGE",
            VincaError::InvalidEncoding(_) => "INVALID_ENCODING",
            VincaError::MalformedComponent(_) => "MALFORMED_COMPONENT",
            VincaError::InvalidCompactBlock(_) => "INVALID_COMPACT_BLOCK",
            VincaError::InvalidTransaction(_) => "INVALID_TRANSACTION",
            VincaError::ReceiptMismatch(_) => "RECEIPT_MISMATCH",
            VincaError::DecryptionFailed(_) => "DECRYPTION_FAILED",
            VincaError::InvalidMemo(_) => "INVALID_MEMO",
            VincaError::InspectionUnavailable(_) => "INSPECTION_UNAVAILABLE",
            VincaError::NoRetainedComponents => "NO_RETAINED_COMPONENTS",
            VincaError::HandleNotFound(_) => "HANDLE_NOT_FOUND",
            _ => "INTERNAL_PROTOCOL_ERROR",
        };
        WorkerResponse::Error {
            code: code.into(),
            message: err.to_string(),
        }
    }
}

/// Dispatches a typed request and returns a typed response.
pub fn handle_request(req: WorkerRequest) -> WorkerResponse {
    match req {
        WorkerRequest::DecodeKey { raw_key, network, label } => {
            // Temporary handle during decode
            let temp_handle = "pending".to_string();
            match decode_uivk(&raw_key, network, temp_handle, label) {
                Ok(mut decoded) => {
                    let opaque_handle = store_key(decoded.retained_orchard);
                    decoded.summary.handle = opaque_handle;
                    let mut declared_unretained = Vec::new();
                    for component in &decoded.summary.components {
                        let component_name = match component.type_code {
                            0x00 | 0x01 => Some("transparent"),
                            0x02 => Some("sapling"),
                            _ => None,
                        };
                        if let Some(name) = component_name {
                            if !declared_unretained.iter().any(|existing| existing == name) {
                                declared_unretained.push(name.to_string());
                            }
                        }
                    }
                    WorkerResponse::success(&DecodedKeyResult {
                        handle: decoded.summary.handle,
                        network: decoded.network,
                        retained_pools: decoded.summary.supported_pools,
                        declared_unretained,
                    })
                }
                Err(err) => WorkerResponse::err(err),
            }
        }
        WorkerRequest::ValidateReceiver { handle, diversifier_hex, pk_d_hex } => {
            let diversifier_bytes = match hex_to_bytes(&diversifier_hex, 11) {
                Ok(b) => {
                    let mut d = [0u8; 11];
                    d.copy_from_slice(&b);
                    d
                }
                Err(e) => return WorkerResponse::err(e),
            };
            let pk_d_bytes = match hex_to_bytes(&pk_d_hex, 32) {
                Ok(b) => {
                    let mut pk = [0u8; 32];
                    pk.copy_from_slice(&b);
                    pk
                }
                Err(e) => return WorkerResponse::err(e),
            };

            let receiver = OrchardRawReceiver {
                diversifier: diversifier_bytes,
                pk_d: pk_d_bytes,
            };

            let res = with_key(&handle, |key| {
                Ok(validate_orchard_receiver(key, &receiver))
            });

            match res {
                Ok(report) => WorkerResponse::success(&report),
                Err(err) => WorkerResponse::err(err),
            }
        }
        WorkerRequest::CompareContexts { handle_a, handle_b } => {
            let res = with_key(&handle_a, |key_a| {
                with_key(&handle_b, |key_b| {
                    Ok(compare_orchard_keys(key_a, key_b))
                })
            });

            match res {
                Ok(report) => WorkerResponse::success(&report),
                Err(err) => WorkerResponse::err(err),
            }
        }
        WorkerRequest::InspectCompactActions { handle, actions } => {
            let res = with_key(&handle, |key| {
                inspect_compact_actions(key, &actions)
            });

            match res {
                Ok(receipts) => WorkerResponse::success(&receipts),
                Err(err) => WorkerResponse::err(err),
            }
        }
        WorkerRequest::DecryptTransactionMemo {
            handle,
            transaction_bytes,
            expected_tx_id_hex,
            block_height,
            network,
            pool,
            action_index,
            expected_amount_zatoshis,
        } => {
            if transaction_bytes.len() > MAX_TRANSACTION_BYTES {
                return WorkerResponse::err(VincaError::InputTooLarge(
                    transaction_bytes.len(),
                    MAX_TRANSACTION_BYTES,
                ));
            }
            let res = with_key(&handle, |key| {
                decrypt_transaction_memo(
                    key,
                    &transaction_bytes,
                    &expected_tx_id_hex,
                    block_height,
                    network,
                    pool,
                    action_index,
                    &expected_amount_zatoshis,
                )
            });

            match res {
                Ok(note) => WorkerResponse::success(&note),
                Err(err) => WorkerResponse::err(err),
            }
        }
        WorkerRequest::RevokeHandle { handle } => {
            let dropped = revoke_key(&handle);
            WorkerResponse::success(&dropped)
        }
        WorkerRequest::LockWorkspace => {
            clear_all_keys();
            WorkerResponse::success(&true)
        }
    }
}

/// Scans a bounded compact-block range using a key held only in WASM memory.
pub fn scan_compact_blocks(
    handle: &str,
    start_height: u32,
    end_height: u32,
    compact_blocks: &[u8],
) -> WorkerResponse {
    match with_key(handle, |key| {
        inspect_compact_blocks(key, compact_blocks, start_height, end_height)
    }) {
        Ok(receipts) => WorkerResponse::success(&receipts),
        Err(err) => WorkerResponse::err(err),
    }
}

fn hex_to_bytes(s: &str, expected_len: usize) -> Result<Vec<u8>, VincaError> {
    let bytes = hex::decode(s).map_err(|e| {
        VincaError::InvalidEncoding(format!("Invalid hex string: {:?}", e))
    })?;
    if bytes.len() != expected_len {
        return Err(VincaError::InvalidEncoding(format!(
            "Expected {} bytes, got {}",
            expected_len,
            bytes.len()
        )));
    }
    Ok(bytes)
}

// Simple internal hex decoder to avoid extra heavy dependencies
mod hex {
    pub fn decode(s: &str) -> Result<Vec<u8>, ()> {
        if s.len() % 2 != 0 {
            return Err(());
        }
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).map_err(|_| ()))
            .collect()
    }
}
