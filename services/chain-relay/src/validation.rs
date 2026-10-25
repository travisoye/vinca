/*
  validation.rs — Input and response validation bounds.

  All public request parameters are validated here before being forwarded to
  upstream helpers. This prevents:
    • Panic-prone inputs reaching upstream convenience methods.
    • Oversized allocations from malformed height ranges.
    • Malformed transaction IDs bypassing upstream checks.
    • Responses larger than the safety ceiling being forwarded to browsers.

  No private data (keys, amounts, labels, memos) ever flows through this
  module or any route handler. These validations only apply to public
  chain-data parameters.
*/

use crate::config::{LimitsConfig, Network, NetworkProfile};
use crate::error::RelayError;

// ---------------------------------------------------------------------------
// Height validation
// ---------------------------------------------------------------------------

/// Validates that a block height is within safe bounds for the given profile.
///
/// Rejects heights at or before genesis (height 0 is invalid for block data)
/// and heights above the configured ceiling.
pub fn validate_height(height: u32, profile: &NetworkProfile) -> Result<(), RelayError> {
    if height == 0 {
        return Err(RelayError::HeightOutOfBounds(
            "Block height 0 is not valid for block-data requests.".into(),
        ));
    }
    if let Some(max) = profile.max_height {
        if height > max {
            return Err(RelayError::HeightOutOfBounds(format!(
                "Height {height} exceeds the configured ceiling {max} for this profile."
            )));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Range validation
// ---------------------------------------------------------------------------

/// Validates a `[start, end]` block range:
///  - `start` must be > 0 and <= `end`.
///  - The span (`end - start + 1`) must not exceed `limits.max_block_range_span`.
///  - Both heights must pass `validate_height`.
pub fn validate_range(
    start: u32,
    end: u32,
    profile: &NetworkProfile,
    limits: &LimitsConfig,
) -> Result<(), RelayError> {
    if start == 0 {
        return Err(RelayError::HeightOutOfBounds(
            "Start height must be > 0.".into(),
        ));
    }
    if end < start {
        return Err(RelayError::HeightOutOfBounds(format!(
            "End height {end} is before start height {start}."
        )));
    }

    let span = end.saturating_sub(start).saturating_add(1);
    if span > limits.max_block_range_span {
        return Err(RelayError::RangeTooLarge {
            requested: span,
            max: limits.max_block_range_span,
        });
    }

    validate_height(start, profile)?;
    validate_height(end, profile)?;
    Ok(())
}

// ---------------------------------------------------------------------------
// Transaction ID validation
// ---------------------------------------------------------------------------

/// Validates that a transaction ID is a valid 64-character lowercase hex string.
///
/// Zcash transaction IDs are 32 bytes (256 bits) displayed as 64 hex chars.
/// We accept both upper- and lower-case and normalise to lowercase before
/// forwarding to the upstream, but the length must be exactly 64 hex digits.
pub fn validate_txid(raw: &str) -> Result<String, RelayError> {
    // Reject obviously-too-long inputs before any allocation.
    if raw.len() != 64 {
        return Err(RelayError::InvalidTxId(format!(
            "Transaction ID must be 64 hex characters; got {} characters.",
            raw.len()
        )));
    }

    let lower = raw.to_ascii_lowercase();

    if !lower.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(RelayError::InvalidTxId(
            "Transaction ID contains non-hex characters.".into(),
        ));
    }

    Ok(lower)
}

// ---------------------------------------------------------------------------
// Network parameter validation
// ---------------------------------------------------------------------------

/// Parses and validates a network name from a URL path segment.
///
/// Mainnet is rejected here; only testnet and regtest are accepted.
pub fn parse_network(raw: &str) -> Result<Network, RelayError> {
    raw.parse::<Network>()
}

// ---------------------------------------------------------------------------
// Response size validation
// ---------------------------------------------------------------------------

/// Returns an error if the byte length of an upstream response exceeds the limit.
pub fn validate_response_size(byte_len: usize, limits: &LimitsConfig) -> Result<(), RelayError> {
    if byte_len > limits.max_response_bytes {
        Err(RelayError::ResponseTooLarge)
    } else {
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Checkpoint validation
// ---------------------------------------------------------------------------

/// Checks whether any of the profile's configured checkpoints are violated by
/// an upstream block response.
///
/// Returns `Err(CheckpointMismatch)` if the upstream returned a hash that does
/// not match the expected hash at a checkpoint height.
///
/// `upstream_hashes` is a map of `height → block_hash_hex` obtained from the
/// upstream response headers or metadata.
pub fn validate_checkpoints(
    profile: &NetworkProfile,
    upstream_hashes: &std::collections::HashMap<u32, String>,
) -> Result<(), RelayError> {
    for checkpoint in &profile.checkpoints {
        if let Some(actual_hash) = upstream_hashes.get(&checkpoint.height) {
            let expected = checkpoint.hash_hex.to_ascii_lowercase();
            let actual = actual_hash.to_ascii_lowercase();
            if expected != actual {
                tracing::warn!(
                    height = checkpoint.height,
                    // Log only the height; never log the actual hash in case it
                    // contains unexpected data from an untrusted upstream.
                    "Checkpoint mismatch detected"
                );
                return Err(RelayError::CheckpointMismatch {
                    height: checkpoint.height,
                });
            }
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Hash format validation
// ---------------------------------------------------------------------------

/// Validates that a block hash is a 64-character lowercase hex string.
pub fn validate_block_hash(raw: &str) -> Result<String, RelayError> {
    if raw.len() != 64 {
        return Err(RelayError::InvalidParameter(format!(
            "Block hash must be 64 hex characters; got {}.",
            raw.len()
        )));
    }
    let lower = raw.to_ascii_lowercase();
    if !lower.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(RelayError::InvalidParameter(
            "Block hash contains non-hex characters.".into(),
        ));
    }
    Ok(lower)
}

// ---------------------------------------------------------------------------
// Action count validation
// ---------------------------------------------------------------------------

/// Maximum Orchard/Sapling action count per transaction accepted without rejection.
/// This prevents hostile inputs from causing excessive WASM-side allocations.
pub const MAX_ACTIONS_PER_TX: usize = 2_048;

/// Validates that an action count is within the safe processing bound.
pub fn validate_action_count(count: usize) -> Result<(), RelayError> {
    if count > MAX_ACTIONS_PER_TX {
        return Err(RelayError::InvalidParameter(format!(
            "Transaction contains {count} actions; maximum is {MAX_ACTIONS_PER_TX}."
        )));
    }
    Ok(())
}
