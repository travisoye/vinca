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
use bech32::{primitives::decode::CheckedHrpstring, Bech32m, Hrp};

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
    if lower.starts_with("ufvk") || lower.starts_with("uviewfull") {
        return Err(VincaError::FullViewingKeyRejected(
            "Detected Unified Full Viewing Key (UFVK); Vinca requires incoming viewing keys only".into(),
        ));
    }

    // 3. Reject mainnet HRP
    if lower.starts_with("uview1") || lower.starts_with("uview") && !lower.starts_with("uviewtest") && !lower.starts_with("uviewregtest") {
        return Err(VincaError::MainnetRejected(
            "Mainnet HRP 'uview' rejected; Vinca strictly operates on testnet and regtest".into(),
        ));
    }

    // 4. Verify expected network HRP
    let expected_hrp = expected_network.hrp_prefix();
    if !lower.starts_with(expected_hrp) {
        return Err(VincaError::InvalidEncoding(format!(
            "Key HRP did not match expected network '{}' (expected '{}')",
            expected_network.hrp_prefix(),
            expected_hrp
        )));
    }

    // 5. Decode Bech32m
    let checked = CheckedHrpstring::new::<Bech32m>(trimmed).map_err(|e| {
        VincaError::InvalidEncoding(format!("Bech32m decoding failed: {:?}", e))
    })?;

    if checked.hrp().as_str() != expected_hrp {
        return Err(VincaError::InvalidEncoding(format!(
            "Mismatched HRP: found '{}', expected '{}'",
            checked.hrp().as_str(),
            expected_hrp
        )));
    }

    let payload: Vec<u8> = checked.byte_iter().collect();
    if payload.is_empty() {
        return Err(VincaError::InvalidEncoding("Decoded payload is empty".into()));
    }

    // 6. Parse TLV components (ZIP 316)
    let raw_components = parse_tlv_components(&payload)?;

    let mut retained_orchard: Option<RetainedOrchardKey> = None;
    let mut component_summaries = Vec::new();
    let mut unretained_components = Vec::new();

    for comp in &raw_components {
        match comp.type_code {
            0x03 => {
                // Orchard Incoming Viewing Key: 64 bytes (32 bytes dk, 32 bytes ivk)
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

/// Helper to parse ZIP 316 TLV encoding.
fn parse_tlv_components(payload: &[u8]) -> Result<Vec<RawTlvComponent>> {
    let mut components = Vec::new();
    let mut cursor = 0;

    while cursor < payload.len() {
        let (type_code, bytes_read) = read_compact_size(&payload[cursor..])?;
        cursor += bytes_read;

        if cursor >= payload.len() {
            return Err(VincaError::MalformedComponent(
                "Truncated component length field".into(),
            ));
        }

        let (length, bytes_read) = read_compact_size(&payload[cursor..])?;
        cursor += bytes_read;

        let len_usize = length as usize;
        if cursor + len_usize > payload.len() {
            return Err(VincaError::MalformedComponent(format!(
                "Component declares {} bytes, but only {} bytes remain",
                len_usize,
                payload.len() - cursor
            )));
        }

        let data = payload[cursor..cursor + len_usize].to_vec();
        cursor += len_usize;

        components.push(RawTlvComponent { type_code, data });
    }

    Ok(components)
}

/// Reads a Bitcoin/Zcash CompactSize integer.
fn read_compact_size(slice: &[u8]) -> Result<(u32, usize)> {
    if slice.is_empty() {
        return Err(VincaError::MalformedComponent("Empty compact size".into()));
    }
    match slice[0] {
        253 => {
            if slice.len() < 3 {
                return Err(VincaError::MalformedComponent("Truncated 2-byte compact size".into()));
            }
            let val = u16::from_le_bytes([slice[1], slice[2]]) as u32;
            Ok((val, 3))
        }
        254 => {
            if slice.len() < 5 {
                return Err(VincaError::MalformedComponent("Truncated 4-byte compact size".into()));
            }
            let val = u32::from_le_bytes([slice[1], slice[2], slice[3], slice[4]]);
            Ok((val, 5))
        }
        255 => Err(VincaError::MalformedComponent(
            "8-byte compact size unsupported in component headers".into(),
        )),
        val => Ok((val as u32, 1)),
    }
}

/// Encodes an Orchard-only UIVK string for test vectors.
pub fn encode_uivk_testnet(dk: &[u8; 32], ivk: &[u8; 32]) -> Result<String> {
    let mut payload = Vec::new();
    // Type 0x03
    payload.push(0x03);
    // Length 64
    payload.push(64);
    payload.extend_from_slice(dk);
    payload.extend_from_slice(ivk);

    let hrp = Hrp::parse("uviewtest").map_err(|e| VincaError::InvalidEncoding(format!("{:?}", e)))?;
    let bech = bech32::encode::<Bech32m>(hrp, &payload)
        .map_err(|e| VincaError::InvalidEncoding(format!("{:?}", e)))?;
    Ok(bech)
}
