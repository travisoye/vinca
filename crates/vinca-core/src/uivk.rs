//! Unified Incoming Viewing Key (UIVK) parsing, policy enforcement, and narrowing.
//!
//! Enforces:
//! - Strict input size bounds (<= 4096 bytes)
//! - Explicit network parameter matching (testnet/regtest only)
//! - Immediate rejection of mainnet, spending keys, and UFVKs
//! - Independent component enumeration per ZIP 316
//! - Safe Orchard-family narrowing with explicit unretained reporting

use crate::errors::{Result, VincaError};
use crate::types::{
    ComponentSummary, ContextSummary, Network, PoolKind, RetainedOrchardKey,
};
use orchard::keys::IncomingViewingKey;
use zcash_address::unified::{Container, Encoding, Ivk, Revision, Uitem, Uivk};
use zcash_protocol::consensus::NetworkType;
use zeroize::Zeroize;

/// Maximum allowable length in bytes for key strings to prevent resource exhaustion.
pub const MAX_UIVK_INPUT_BYTES: usize = 4096;

/// Parsed UIVK structure containing retained cryptographic keys and metadata.
#[derive(Debug, Clone)]
pub struct DecodedUivk {
    pub network: Network,
    pub retained_orchard: RetainedOrchardKey,
    pub raw_components: Vec<RawTlvComponent>,
    pub summary: ContextSummary,
}

/// Raw TLV component representation from the UIVK payload.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawTlvComponent {
    pub type_code: u32,
    pub data: Vec<u8>,
}

/// Decodes, parses, and validates a UIVK string under the specified network.
pub fn decode_uivk(raw_str: &str, expected_network: Network, handle: String, label: String) -> Result<DecodedUivk> {
    // 1. Bound check
    let trimmed = raw_str.trim();
    if trimmed.len() > MAX_UIVK_INPUT_BYTES {
        return Err(VincaError::InputTooLarge(trimmed.len(), MAX_UIVK_INPUT_BYTES));
    }
    if trimmed.is_empty() {
        return Err(VincaError::InvalidEncoding("Empty key input".into()));
    }

    // 2. Reject spending keys and UFVKs immediately
    let lower = trimmed.to_ascii_lowercase();
    if lower.starts_with("secret") || lower.contains("spend") {
        return Err(VincaError::SpendingKeyRejected(
            "Detected potential spending key or seed prefix".into(),
        ));
    }
    if lower.starts_with("uview") || lower.starts_with("uvf") || lower.starts_with("ufvk") {
        return Err(VincaError::FullViewingKeyRejected(
            "Detected Unified Full Viewing Key (UFVK); Vinca requires incoming viewing keys only".into(),
        ));
    }

    // 3. Reject mainnet UIVK prefixes. Testnet and regtest prefixes are
    // checked by the ZIP-316 decoder below.
    if lower.starts_with("uivk1") || lower.starts_with("uvi1") {
        return Err(VincaError::MainnetRejected(
            "Mainnet UIVK encoding rejected; Vinca strictly operates on testnet and regtest".into(),
        ));
    }

    // ZIP-316 decoding validates the Bech32m encoding, revision-specific
    // jumbling, TLV structure, and the network encoded by the key.
    let (actual_network, _revision, uivk) = Uivk::decode(trimmed)
        .map_err(|e| VincaError::InvalidEncoding(format!("ZIP-316 UIVK decoding failed: {e}")))?;
    let key_network = match actual_network {
        NetworkType::Main => {
            return Err(VincaError::MainnetRejected(
                "Mainnet UIVK encoding rejected; Vinca strictly operates on testnet and regtest".into(),
            ));
        }
        NetworkType::Test => Network::Testnet,
        NetworkType::Regtest => Network::Regtest,
    };
    if key_network != expected_network {
        return Err(VincaError::InvalidEncoding(format!(
            "Key network '{}' did not match selected network '{}'",
            key_network.as_str(),
            expected_network.as_str()
        )));
    }

    let mut retained_orchard: Option<RetainedOrchardKey> = None;
    let mut raw_components = Vec::new();
    let mut component_summaries = Vec::new();
    let mut unretained_components = Vec::new();

    for item in uivk.items_as_parsed() {
        let component = match item {
            Uitem::Data(Ivk::Orchard(data)) => Some((0x03, data.to_vec())),
            Uitem::Data(Ivk::Sapling(data)) => Some((0x02, data.to_vec())),
            Uitem::Data(Ivk::P2pkh(data)) => Some((0x00, data.to_vec())),
            Uitem::Data(Ivk::P2sh(data)) => Some((0x01, data.to_vec())),
            Uitem::Data(Ivk::Unknown { typecode, .. }) => {
                return Err(VincaError::UnknownComponent(*typecode));
            }
            Uitem::Metadata(_) => None,
        };
        let Some((type_code, data)) = component else {
            continue;
        };
        let comp = RawTlvComponent { type_code, data };

        match comp.type_code {
            0x03 => {
                if comp.data.len() != 64 {
                    return Err(VincaError::MalformedComponent(format!(
                        "Orchard component length is {}, expected 64 bytes",
                        comp.data.len()
                    )));
                }
                let mut dk = [0u8; 32];
                let mut ivk = [0u8; 32];
                dk.copy_from_slice(&comp.data[0..32]);
                ivk.copy_from_slice(&comp.data[32..64]);
                let mut encoded = [0u8; 64];
                encoded.copy_from_slice(&comp.data);
                let valid = Option::<IncomingViewingKey>::from(
                    IncomingViewingKey::from_bytes(&encoded),
                )
                .is_some();
                encoded.zeroize();
                if !valid {
                    dk.zeroize();
                    ivk.zeroize();
                    return Err(VincaError::MalformedComponent(
                        "Orchard incoming viewing key is invalid".into(),
                    ));
                }

                retained_orchard = Some(RetainedOrchardKey { dk, ivk });
                component_summaries.push(ComponentSummary {
                    type_code: 0x03,
                    type_name: "Orchard".into(),
                    byte_length: comp.data.len(),
                    retained: true,
                    note: "Retained for Orchard + Ironwood incoming inspection".into(),
                });
            }
            0x02 => {
                // Sapling Incoming Viewing Key: 64 bytes (declared, not retained under Orchard-family policy)
                component_summaries.push(ComponentSummary {
                    type_code: 0x02,
                    type_name: "Sapling".into(),
                    byte_length: comp.data.len(),
                    retained: false,
                    note: "Declared in key, not retained under Orchard-family policy".into(),
                });
                unretained_components.push("Sapling declared, not retained".into());
            }
            0x00 => {
                // Transparent P2PKH
                component_summaries.push(ComponentSummary {
                    type_code: 0x00,
                    type_name: "Transparent P2PKH".into(),
                    byte_length: comp.data.len(),
                    retained: false,
                    note: "Transparent component declared, not retained".into(),
                });
                unretained_components.push("Transparent P2PKH declared, not retained".into());
            }
            0x01 => {
                // Transparent P2SH
                component_summaries.push(ComponentSummary {
                    type_code: 0x01,
                    type_name: "Transparent P2SH".into(),
                    byte_length: comp.data.len(),
                    retained: false,
                    note: "Transparent component declared, not retained".into(),
                });
                unretained_components.push("Transparent P2SH declared, not retained".into());
            }
            other => {
                return Err(VincaError::UnknownComponent(other));
            }
        }
        raw_components.push(comp);
    }

    let orchard_key = retained_orchard.ok_or(VincaError::NoRetainedComponents)?;

    let summary = ContextSummary {
        handle: handle.clone(),
        label,
        network: expected_network,
        birthday_height: 0,
        supported_pools: vec![PoolKind::Orchard, PoolKind::Ironwood],
        components: component_summaries,
        unretained_components,
    };

    Ok(DecodedUivk {
        network: expected_network,
        retained_orchard: orchard_key,
        raw_components,
        summary,
    })
}

/// Encodes an Orchard-only UIVK string for test vectors.
pub fn encode_uivk_testnet(dk: &[u8; 32], ivk: &[u8; 32]) -> Result<String> {
    let mut encoded = [0u8; 64];
    encoded[..32].copy_from_slice(dk);
    encoded[32..].copy_from_slice(ivk);
    if Option::<IncomingViewingKey>::from(IncomingViewingKey::from_bytes(&encoded)).is_none() {
        encoded.zeroize();
        return Err(VincaError::MalformedComponent(
            "Orchard incoming viewing key is invalid".into(),
        ));
    }

    let container_result = Uivk::try_from_items(
        Revision::R0,
        vec![Uitem::Data(Ivk::Orchard(encoded))],
    );
    encoded.zeroize();
    let container = container_result
        .map_err(|e| VincaError::InvalidEncoding(format!("ZIP-316 encoding failed: {e}")))?;
    Ok(container.encode(&NetworkType::Test))
}
