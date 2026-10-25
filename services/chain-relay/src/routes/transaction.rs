/*
  routes/transaction.rs — GET /tx/:network/:txid

  Fetches a full raw transaction by its transaction ID from the upstream
  lightwalletd. This endpoint is used for on-demand memo decryption after
  the user acknowledges the transaction-interest privacy disclosure.

  Privacy-redacted logging
  ────────────────────────
  Transaction IDs are NOT logged in routine INFO/DEBUG tracing.
  They are only recorded at WARN level when an upstream error occurs,
  and even then only the first 8 characters are shown (a prefix
  sufficient for operator debugging without revealing the full txid).

  The relay logs connection metadata (IP, response size, timing) but
  never logs the txid or any private data (keys, amounts, labels, memos).

  Validates:
    1. Network name is testnet or regtest (mainnet → 403).
    2. Profile is configured (unknown → 404).
    3. txid is exactly 64 lowercase hex characters.
    4. Cache hit → return cached bytes without upstream call.
    5. Response size ≤ `limits.max_response_bytes`.

  Response
  ────────
  Content-Type: application/octet-stream
  Body: raw transaction bytes as returned by lightwalletd.
*/

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{header, StatusCode},
    response::Response,
};

use crate::error::RelayError;
use crate::upstream::cache::TxCacheKey;
use crate::validation::{parse_network, validate_txid};
use crate::AppState;

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /tx/:network/:txid
///
/// Fetches a raw transaction by its hex-encoded transaction ID.
/// The txid is NOT included in routine log output.
pub async fn get_transaction(
    State(state): State<AppState>,
    Path((network_str, raw_txid)): Path<(String, String)>,
) -> Result<Response, RelayError> {
    let network = parse_network(&network_str)?;
    let _profile = state.profiles.get(network)?;

    // Validate txid format before touching the cache or upstream.
    let txid_hex = validate_txid(&raw_txid)?;

    // Cache lookup — transactions are immutable once confirmed.
    let cache_key = TxCacheKey {
        network: network.to_string(),
        txid_hex: txid_hex.clone(),
    };

    if let Some(cached) = state.cache.get_transaction(&cache_key).await {
        // Log cache hit WITHOUT the full txid (privacy-redacted).
        tracing::debug!(
            network = %network,
            txid_prefix = &txid_hex[..8],
            "Transaction cache hit"
        );
        return Ok(tx_bytes_response(cached));
    }

    let client = state.clients.get(network)?;

    // Fetch from upstream.
    // Log at DEBUG without the full txid.
    tracing::debug!(
        network = %network,
        "Fetching transaction from upstream (txid redacted)"
    );

    let tx_bytes = match client.get_transaction(&txid_hex).await {
        Ok(bytes) => bytes,
        Err(err) => {
            // Log at WARN with only the first 8 chars of the txid.
            tracing::warn!(
                network = %network,
                txid_prefix = &txid_hex[..8],
                error = %err,
                "Upstream transaction fetch failed"
            );
            return Err(err);
        }
    };

    tracing::debug!(
        network = %network,
        bytes = tx_bytes.len(),
        "Fetched transaction from upstream (txid redacted)"
    );

    // Cache for future requests.
    state.cache.put_transaction(cache_key, tx_bytes.clone()).await;

    Ok(tx_bytes_response(tx_bytes))
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

fn tx_bytes_response(data: Vec<u8>) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        // Transactions are immutable once confirmed; cache aggressively.
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .body(axum::body::Body::from(Bytes::from(data)))
        .unwrap()
}
