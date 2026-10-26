//! Error definitions for the Vinca protocol inspection core.
//!
//! Every error strictly preserves the privacy and security boundaries of Vinca:
//! - Mainnet encodings and networks are explicitly rejected.
//! - Spending keys and Full Viewing Keys (UFVK) are explicitly rejected.
//! - Input size and memory allocations are strictly bounded to prevent DoS.

use thiserror::Error;

/// Domain error enumeration for vinca-core.
#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum VincaError {
    #[error("Input length {0} exceeds maximum allowed bound of {1} bytes")]
    InputTooLarge(usize, usize),

    #[error("Mainnet encoding detected ({0}); Vinca strictly operates on testnet and reproducible regtest")]
    MainnetRejected(String),

    #[error("Spending key or seed material detected ({0}); Vinca only accepts incoming viewing material")]
    SpendingKeyRejected(String),

    #[error("Unified Full Viewing Key (UFVK) detected ({0}); Vinca requires incoming viewing keys (UIVK) only")]
    FullViewingKeyRejected(String),

    #[error("Invalid Bech32m or key encoding: {0}")]
    InvalidEncoding(String),

    #[error("Unrecognized or unsupported component type code: 0x{0:02x}")]
    UnknownComponent(u32),

    #[error("Malformed component TLV payload: {0}")]
    MalformedComponent(String),

    #[error("Key contains no retained Orchard-family components")]
    NoRetainedComponents,

    #[error("Unified address contains no Orchard receiver")]
    NoOrchardReceiver,

    #[error("Receiver validation failed for pool {pool}: {reason}")]
    ReceiverValidationFailed {
        pool: &'static str,
        reason: String,
    },

    #[error("Block height {0} is out of valid bounds ({1}..={2})")]
    HeightOutOfBounds(u64, u64, u64),

    #[error("Action count {0} exceeds maximum block bound of {1}")]
    TooManyActions(usize, usize),

    #[error("Invalid compact-block response: {0}")]
    InvalidCompactBlock(String),

    #[error("Protocol inspection is unavailable: {0}")]
    InspectionUnavailable(String),

    #[error("Note trial decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Memo payload corrupted or length exceeds 512 bytes: {0}")]
    InvalidMemo(String),

    #[error("Session handle '{0}' not found or has been revoked")]
    HandleNotFound(String),
}

/// Convenience result alias for vinca-core.
pub type Result<T> = std::result::Result<T, VincaError>;
