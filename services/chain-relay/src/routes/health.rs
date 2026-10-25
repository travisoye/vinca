/*
  routes/health.rs — Health and readiness endpoints.

  GET /health  — Liveness probe. Returns 200 if the process is running.
  GET /ready   — Readiness probe. Returns 200 only if at least one upstream
                 profile is reachable; 503 otherwise.

  These endpoints never log or expose private data. They are safe to scrape
  by infrastructure tooling.
*/

use axum::{extract::State, http::StatusCode, response::Json};
use serde::Serialize;

use crate::AppState;
use crate::config::Network;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
}

#[derive(Serialize)]
pub struct ReadinessResponse {
    pub status: &'static str,
    pub configured_networks: Vec<String>,
    /// Per-network upstream reachability. True = last tip fetch succeeded.
    pub upstream_status: Vec<NetworkStatus>,
}

#[derive(Serialize)]
pub struct NetworkStatus {
    pub network: String,
    pub reachable: bool,
    /// Most recently observed tip height. None if unreachable.
    pub tip_height: Option<u64>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /health — always 200 while the process is running.
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse { status: "ok" })
}

/// GET /ready — checks upstream reachability for all configured profiles.
pub async fn ready(State(state): State<AppState>) -> (StatusCode, Json<ReadinessResponse>) {
    let networks = state.profiles.networks();
    let mut upstream_status = Vec::with_capacity(networks.len());
    let mut all_reachable = true;

    for network in &networks {
        let (reachable, tip_height) = match state.clients.get(*network) {
            Ok(client) => match client.get_latest_height().await {
                Ok(h) => (true, Some(h)),
                Err(_) => {
                    all_reachable = false;
                    (false, None)
                }
            },
            Err(_) => {
                all_reachable = false;
                (false, None)
            }
        };

        upstream_status.push(NetworkStatus {
            network: network.to_string(),
            reachable,
            tip_height,
        });
    }

    let status_code = if all_reachable {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (
        status_code,
        Json(ReadinessResponse {
            status: if all_reachable { "ready" } else { "degraded" },
            configured_networks: networks.iter().map(|n| n.to_string()).collect(),
            upstream_status,
        }),
    )
}
