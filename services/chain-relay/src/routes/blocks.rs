/*
  routes/blocks.rs — GET /blocks/:network?start=<u32>&end=<u32>

  Fetches a compact block range from the upstream lightwalletd and returns it
  as raw length-delimited protobuf bytes suitable for browser-side WASM
  trial decryption.

  Validates (in order):
    1. Network name is testnet or regtest (mainnet → 403).
    2. Profile is configured (unknown → 404).
    3. `start` and `end` query parameters are present and parseable.
    4. `start` > 0 and `end` >= `start`.
    5. Span (`end - start + 1`) ≤ `limits.max_block_range_span`.
    6. Both heights are within the profile's `max_height` ceiling.
    7. Cache hit → return cached bytes.
    8. Response bytes from upstream ≤ `limits.max_response_bytes`.

  Response
  ────────
  Content-Type: application/octet-stream
  Body: raw length-delimited protobuf compact block bytes.

  The browser WASM worker knows how to decode this format (4-byte big-endian
  length prefix per block, followed by serialised CompactBlock proto).
*/

use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::Response,
};
use serde::Deserialize;

use crate::error::RelayError;
use crate::upstream::cache::{BlockRangeCacheKey, RelayCache};
use crate::validation::{parse_network, validate_range};
use crate::AppState;

// ---------------------------------------------------------------------------
// Query parameters
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct BlockRangeParams {
    pub start: Option<u32>,
    pub end: Option<u32>,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /blocks/:network?start=N&end=M
pub async fn get_blocks(
    State(state): State<AppState>,
    Path(network_str): Path<String>,
    Query(params): Query<BlockRangeParams>,
) -> Result<Response, RelayError> {
    let network = parse_network(&network_str)?;
    let profile = state.profiles.get(network)?;

    let start = params
        .start
        .ok_or_else(|| RelayError::InvalidParameter("`start` query parameter is required.".into()))?;
    let end = params
        .end
        .ok_or_else(|| RelayError::InvalidParameter("`end` query parameter is required.".into()))?;

    validate_range(start, end, profile, &state.config.limits)?;

    // Cache lookup.
    let cache_key = BlockRangeCacheKey {
        network: network.to_string(),
        start_height: start,
        end_height: end,
    };

    if let Some(cached) = state.cache.get_blocks(&cache_key).await {
        tracing::debug!(network = %network, start, end, "Block range cache hit");
        return Ok(bytes_response(cached));
    }

    // Upstream fetch with retry.
    let client = state.clients.get(network)?;
    let block_bytes = fetch_with_retry(
        || client.get_block_range(start, end),
        state.config.limits.max_retries,
    )
    .await?;

    tracing::debug!(
        network = %network,
        start,
        end,
        bytes = block_bytes.len(),
        "Fetched block range from upstream"
    );

    // Store in cache before returning.
    state.cache.put_blocks(cache_key, block_bytes.clone()).await;

    Ok(bytes_response(block_bytes))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn bytes_response(data: Vec<u8>) -> Response {
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/octet-stream")
        .header(
            header::CACHE_CONTROL,
            "public, max-age=300, stale-while-revalidate=60",
        )
        .body(axum::body::Body::from(Bytes::from(data)))
        .unwrap()
}

/// Retries `f` up to `max_retries` times on transient upstream errors.
/// Upstream errors that are definitively non-retryable (mainnet, bad request)
/// are returned immediately.
async fn fetch_with_retry<F, Fut>(mut f: F, max_retries: u32) -> Result<Vec<u8>, RelayError>
where
    F: FnMut() -> Fut,
    Fut: std::future::Future<Output = Result<Vec<u8>, RelayError>>,
{
    let mut last_err = None;
    for attempt in 0..=max_retries {
        match f().await {
            Ok(data) => return Ok(data),
            Err(err) => {
                let retryable = matches!(
                    &err,
                    RelayError::UpstreamUnavailable { .. } | RelayError::SourceStale { .. }
                );
                if !retryable || attempt == max_retries {
                    return Err(err);
                }
                tracing::warn!(attempt, "Upstream transient error; retrying");
                // Simple linear back-off: (attempt + 1) * 500 ms.
                tokio::time::sleep(std::time::Duration::from_millis(
                    500 * (attempt as u64 + 1),
                ))
                .await;
                last_err = Some(err);
            }
        }
    }
    Err(last_err.unwrap())
}
