/*
  main.rs — Vinca chain relay entry point.

  Startup sequence
  ────────────────
  1. Initialise structured JSON logging (tracing-subscriber).
  2. Load RelayConfig from environment variables + optional relay.toml.
  3. Validate the configuration (allowlist, profiles, no mainnet).
  4. Build the ProfileIndex (validated runtime lookup table).
  5. Connect upstream clients (one per configured profile).
  6. Initialise the bounded in-memory cache.
  7. Build the Axum router with all middleware.
  8. Bind a TCP listener on the configured port.
  9. Serve with graceful shutdown on SIGTERM/SIGINT.

  Privacy notes
  ─────────────
  • No private data (keys, labels, amounts, memos) is ever in scope here.
  • The relay.toml config file may contain upstream URLs; these are never
    logged — only a redacted form is used in error messages.
  • The structured log output uses JSON format; it never includes request
    bodies or upstream gRPC responses.

  Environment variables
  ─────────────────────
  PORT         — TCP listen port (default: 8080)
  WEB_ORIGIN   — Comma-separated allowed CORS origins
  RELAY_CONFIG — Path to relay.toml (default: ./relay.toml)
*/

mod config;
mod error;
mod routes;
mod upstream;
mod validation;

use std::net::SocketAddr;
use std::sync::Arc;

use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use config::{ProfileIndex, RelayConfig};
use upstream::{cache::RelayCache, UpstreamClients};

// ---------------------------------------------------------------------------
// Shared application state (cheaply cloneable via Arc internals)
// ---------------------------------------------------------------------------

/// Shared state injected into every Axum route handler.
#[derive(Clone)]
pub struct AppState {
    pub config: Arc<RelayConfig>,
    pub profiles: Arc<ProfileIndex>,
    pub clients: Arc<UpstreamClients>,
    pub cache: Arc<RelayCache>,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Logging.
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            // Default: info-level for the relay; suppress noisy tower internals.
            "vinca_chain_relay=info,tower_http=warn".into()
        }))
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    tracing::info!("Vinca chain relay starting");

    // 2. Load config.
    let config_path = std::env::var("RELAY_CONFIG").unwrap_or_else(|_| "relay.toml".to_string());
    let config: RelayConfig = load_config(&config_path)?;

    // 3. Validate.
    config.validate()?;

    tracing::info!(
        profiles = config.profiles.len(),
        port = config.port,
        "Configuration validated"
    );

    // 4. Build profile index.
    let profiles = Arc::new(ProfileIndex::from_config(&config));

    // 5. Connect upstream clients.
    let clients = Arc::new(UpstreamClients::from_config(&config).await?);

    // 6. Cache.
    let cache = Arc::new(RelayCache::new(&config.cache));

    let state = AppState {
        config: Arc::new(config.clone()),
        profiles,
        clients,
        cache,
    };

    // 7. Build router.
    let router = routes::build_router(state);

    // 8. Bind listener.
    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(addr = %addr, "Listening");

    // 9. Serve with graceful shutdown.
    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Relay shut down cleanly");
    Ok(())
}

// ---------------------------------------------------------------------------
// Config loading
// ---------------------------------------------------------------------------

fn load_config(path: &str) -> anyhow::Result<RelayConfig> {
    // Build from file + environment overrides.
    let builder = config::Config::builder()
        .add_source(config::File::with_name(path).required(false))
        .add_source(config::Environment::with_prefix("RELAY").separator("__"))
        // Allow PORT and WEB_ORIGIN as top-level env vars for Render/Vercel compatibility.
        .set_override_option("port", std::env::var("PORT").ok())?
        .set_override_option(
            "allowed_origins",
            std::env::var("WEB_ORIGIN")
                .ok()
                .map(|v| v.split(',').map(str::trim).map(str::to_string).collect::<Vec<_>>()),
        )?;

    let mut cfg: RelayConfig = builder.build()?.try_deserialize()?;

    // Support LIGHTWALLETD_TESTNET_URL environment variable (Render / Docker / 12-factor standard)
    if let Ok(testnet_url) = std::env::var("LIGHTWALLETD_TESTNET_URL") {
        let trimmed = testnet_url.trim();
        if !trimmed.is_empty() {
            if !cfg.upstream_allowlist.iter().any(|allowed| trimmed.starts_with(allowed)) {
                cfg.upstream_allowlist.push(trimmed.to_string());
            }

            if cfg.profile_for(config::Network::Testnet).is_none() {
                cfg.profiles.push(config::NetworkProfile {
                    network: config::Network::Testnet,
                    upstream_url: trimmed.to_string(),
                    sapling_activation_height: 280_000,
                    orchard_activation_height: 1_842_420,
                    ironwood_activation_height: None,
                    checkpoints: vec![],
                    max_height: None,
                });
            }
        }
    }

    Ok(cfg)
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async fn shutdown_signal() {
    use tokio::signal;

    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install CTRL+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received; draining in-flight requests");
}
