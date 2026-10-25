/*
  routes/tip.rs — GET /tip/:network

  Returns the current chain tip height as seen by the upstream lightwalletd
  for the requested network.

  Validates:
    • Network name is testnet or regtest (mainnet → 403).
    • Network profile is configured (unknown → 404).
    • Upstream returns within the timeout (timeout → 502).
    • Tip height > 0 (stale/bad upstream → 502).
*/

use axum::{
    extract::{Path, State},
    response::Json,
};
use serde::Serialize;

use crate::error::RelayError;
use crate::validation::parse_network;
use crate::AppState;

// ---------------------------------------------------------------------------
// Response type
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct TipResponse {
    pub network: String,
    pub tip_height: u64,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /tip/:network — returns the current chain tip height.
pub async fn get_tip(
    State(state): State<AppState>,
    Path(network_str): Path<String>,
) -> Result<Json<TipResponse>, RelayError> {
    let network = parse_network(&network_str)?;

    // Check profile is configured.
    let _profile = state.profiles.get(network)?;

    let client = state.clients.get(network)?;
    let tip_height = client.get_latest_height().await?;

    if tip_height == 0 {
        return Err(RelayError::SourceStale { tip_height: 0 });
    }

    tracing::debug!(network = %network, tip_height, "Served tip height");

    Ok(Json(TipResponse {
        network: network.to_string(),
        tip_height,
    }))
}
