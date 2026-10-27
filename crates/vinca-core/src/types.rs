//! Domain type definitions for the Vinca protocol inspection core.

use serde::{Deserialize, Serialize};
use zeroize::{Zeroize, ZeroizeOnDrop};

/// Supported networks in Vinca (testnet and reproducible regtest only).
/// Mainnet is rejected at the protocol boundary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Testnet,
    Regtest,
}

impl Network {
    pub fn as_str(&self) -> &'static str {
        match self {
            Network::Testnet => "testnet",
            Network::Regtest => "regtest",
        }
    }

    pub fn hrp_prefix(&self) -> &'static str {
        match self {
            Network::Testnet => "uivktest",
            Network::Regtest => "uivkregtest",
        }
    }
}

/// Supported shielded pools under Vinca's Orchard-family policy.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolKind {
    Orchard,
    Ironwood,
}

/// Known component kinds in Unified Incoming Viewing Keys (ZIP 316).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ComponentKind {
    Orchard,
    Sapling,
    TransparentP2pkh,
    TransparentP2sh,
    Unknown(u32),
}

/// Summary of an individual component discovered inside an imported key.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ComponentSummary {
    pub type_code: u32,
    pub type_name: String,
    pub byte_length: usize,
    pub retained: bool,
    pub note: String,
}

/// Retained Orchard incoming viewing key material.
/// Cleared on drop to protect memory contents.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct RetainedOrchardKey {
    pub dk: [u8; 32],
    pub ivk: [u8; 32],
}

impl std::fmt::Debug for RetainedOrchardKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "RetainedOrchardKey([redacted])")
    }
}

/// Presentation-safe context summary returned to UI/worker.
/// Contains no raw private key material; identified by an opaque handle.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ContextSummary {
    pub handle: String,
    pub label: String,
    pub network: Network,
    pub birthday_height: u64,
    pub supported_pools: Vec<PoolKind>,
    pub components: Vec<ComponentSummary>,
    pub unretained_components: Vec<String>,
}

/// Independent receiver validation report.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ReceiverValidation {
    pub pool: PoolKind,
    pub matched: bool,
    pub details: String,
}

/// Overlap classification between two viewing contexts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OverlapKind {
    /// Exact match on all component key bytes.
    IdenticalKey,
    /// Identical incoming viewing key scalar (ivk) with different diversifier key (dk).
    /// Both keys decrypt the exact same receipts despite different addresses.
    IdenticalDecryptionScalar,
    /// Shared diversifier key (dk) with different decryption scalar (ivk).
    /// Both keys generate matching diversifiers, but cannot decrypt each other's notes.
    SharedDiversifierKey,
    /// Completely disjoint capabilities.
    Disjoint,
}

/// Structured comparison report between two contexts.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OverlapReport {
    pub kind: OverlapKind,
    pub summary: String,
    pub shared_pools: Vec<PoolKind>,
    pub cautions: Vec<String>,
}

/// A compact note action inspected during block scanning.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompactAction {
    pub nullifier: [u8; 32],
    pub cmx: [u8; 32],
    pub ephemeral_key: [u8; 32],
    pub enc_ciphertext: Vec<u8>,
}

/// A discovered incoming note receipt with exact integer zatoshis.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CompactReceipt {
    pub action_index: usize,
    pub pool: PoolKind,
    pub amount_zatoshis: u64,
    pub is_recipient: bool,
}

/// An Orchard note found while decoding a complete compact-block range.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScannedReceipt {
    pub tx_id_hex: String,
    pub action_index: usize,
    pub block_height: u32,
    pub block_time: u32,
    pub amount_zatoshis: String,
    pub pool: PoolKind,
}

/// The decoded memo from a transaction selected by a locally scanned receipt.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DecryptedMemo {
    pub format: MemoFormat,
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_bytes_hex: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum MemoFormat {
    Text,
    ArbitraryBytes,
    NoMemo,
    FutureFormat,
    LegacyNontext,
}
