//! Vinca Core: Protocol inspection and note decryption engine for Zcash viewing material.
//!
//! Designed strictly for browser WebAssembly workers and desktop/CLI tooling:
//! - Pure cryptographic logic with no direct network or DOM calls.
//! - Rejection of mainnet encodings, spending keys, and full viewing keys.
//! - Independent receiver evaluation.
//! - Accurate overlap detection (ivk vs dk).
//! - Exact integer zatoshis handling.

pub mod errors;
pub mod notes;
pub mod overlap;
pub mod receivers;
pub mod types;
pub mod uivk;

// Re-exports
pub use errors::{Result, VincaError};
pub use notes::{
    decrypt_transaction_memo, inspect_compact_actions, inspect_compact_blocks,
    MAX_ACTIONS_PER_BLOCK, MAX_MEMO_BYTES, MAX_TRANSACTION_BYTES,
};
pub use overlap::compare_orchard_keys;
pub use receivers::{validate_multi_receiver, validate_orchard_receiver, OrchardRawReceiver};
pub use types::{
    CompactAction, CompactReceipt, ComponentKind, ComponentSummary, ContextSummary, DecryptedMemo,
    MemoFormat, Network, OverlapKind, OverlapReport, PoolKind, ReceiverValidation,
    RetainedOrchardKey, ScannedReceipt,
};
pub use uivk::{decode_uivk, encode_uivk_testnet, DecodedUivk, RawTlvComponent, MAX_UIVK_INPUT_BYTES};
