/*
  routes/mod.rs — Axum router assembly.

  Assembles the relay's route tree with:
    • Per-route middleware (timeouts, body size limits, tracing spans).
    • CORS configuration from the operator-configured allowed origins list.
    • Shared AppState injected as Axum extension.

  Route table
  ───────────
  GET  /health                         — liveness probe
  GET  /ready                          — readiness probe (upstream check)
  GET  /profiles                       — list configured network profiles
  GET  /tip/:network                   — current tip height
  GET  /blocks/:network?start=N&end=M  — compact block range
  GET  /tx/:network/:txid              — full raw transaction (privacy-redacted log)

  No POST routes, no wallet RPC proxy, no arbitrary-URL forwarding.

  CORS
  ────
  `Access-Control-Allow-Origin` is set to the exact operator-configured
  allowed origins only. Wildcards are not used. Browsers that send a
  different origin receive a CORS rejection.
*/

pub mod blocks;
pub mod health;
pub mod profiles;
pub mod tip;
pub mod transaction;

use std::time::Duration;

use axum::{
    Router,
    routing::get,
};
use tower::ServiceBuilder;
use tower_http::{
    cors::{AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    timeout::TimeoutLayer,
    trace::TraceLayer,
};
use http::HeaderValue;

use crate::AppState;

/// Builds and returns the complete Axum router.
pub fn build_router(state: AppState) -> Router {
    let timeout_secs = state.config.limits.upstream_timeout_secs;
    let max_request_bytes = state.config.limits.max_request_bytes;
    let allowed_origins = state.config.allowed_origins.clone();

    // --- CORS ----------------------------------------------------------------
    let cors = build_cors_layer(&allowed_origins);

    // --- Route tree ----------------------------------------------------------
    let api = Router::new()
        .route("/health", get(health::health))
        .route("/ready", get(health::ready))
        .route("/profiles", get(profiles::list_profiles))
        .route("/tip/:network", get(tip::get_tip))
        .route("/blocks/:network", get(blocks::get_blocks))
        .route("/tx/:network/:txid", get(transaction::get_transaction));

    Router::new()
        .merge(api)
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(TimeoutLayer::new(Duration::from_secs(timeout_secs + 5)))
                .layer(RequestBodyLimitLayer::new(max_request_bytes))
                .layer(cors),
        )
        .with_state(state)
}

// ---------------------------------------------------------------------------
// CORS builder
// ---------------------------------------------------------------------------

fn build_cors_layer(allowed_origins: &[String]) -> CorsLayer {
    if allowed_origins.is_empty() {
        // No origins configured → deny all cross-origin requests.
        return CorsLayer::new();
    }

    let origins: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|origin| origin.parse::<HeaderValue>().ok())
        .collect();

    CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([http::Method::GET])
        .allow_headers([http::header::CONTENT_TYPE])
        .max_age(Duration::from_secs(3600))
}
