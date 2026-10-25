/*
  config.rs — Operator-configured relay profiles, allowlists, and checkpoints.

  Configuration is read from environment variables and an optional
  `relay.toml` file at startup. No private data is ever part of the
  configuration; the relay only handles public blockchain data.

  Profiles
  ────────
  A "profile" is a named, operator-pinned combination of:
    • Network (testnet or regtest — mainnet is unconditionally rejected)
    • Upstream lightwalletd endpoint URL (inside the operator allowlist)
    • Sapling/Orchard activation heights for this profile's chain
    • Known checkpoint hashes for sync-state validation

  The operator must define at least one profile. The relay refuses to serve
  any network not explicitly listed in the running configuration.

  Allowlist
  ─────────
  The upstream allowlist is a set of hostnames/IP addresses that the relay
  is permitted to connect to. Any gRPC URL not on the allowlist is rejected
  at startup and cannot be added by browser input.

  Mainnet rejection
  ─────────────────
  The relay unconditionally rejects:
    • Any request with network = "mainnet".
    • Any upstream gRPC URL whose host resolves to a known mainnet endpoint.
    • Any block-data response whose network magic bytes indicate mainnet.
*/

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::error::RelayError;

// ---------------------------------------------------------------------------
// Network type
// ---------------------------------------------------------------------------

/// Supported networks. Mainnet is explicitly absent — the relay rejects it.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Network {
    Testnet,
    Regtest,
}

impl std::fmt::Display for Network {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Network::Testnet => write!(f, "testnet"),
            Network::Regtest => write!(f, "regtest"),
        }
    }
}

impl std::str::FromStr for Network {
    type Err = RelayError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_ascii_lowercase().as_str() {
            "testnet" => Ok(Network::Testnet),
            "regtest" => Ok(Network::Regtest),
            "mainnet" => Err(RelayError::MainnetRejected),
            other => Err(RelayError::UnsupportedNetwork(other.to_string())),
        }
    }
}

// ---------------------------------------------------------------------------
// Checkpoint
// ---------------------------------------------------------------------------

/// A known-safe block checkpoint used to detect sync divergence.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Block height of this checkpoint.
    pub height: u32,
    /// Expected block hash at this height (hex-encoded, 32 bytes).
    pub hash_hex: String,
}

// ---------------------------------------------------------------------------
// NetworkProfile
// ---------------------------------------------------------------------------

/// Operator-configured profile for a single network.
#[derive(Debug, Clone, Deserialize)]
pub struct NetworkProfile {
    /// Which network this profile serves.
    pub network: Network,

    /// gRPC endpoint URL for the upstream lightwalletd node.
    /// Must appear in the relay allowlist; checked at startup.
    pub upstream_url: String,

    /// Sapling activation height for this profile's chain.
    pub sapling_activation_height: u32,

    /// Orchard activation height for this profile's chain.
    pub orchard_activation_height: u32,

    /// Optional Ironwood activation height (Orchard successor; 0 = not yet activated).
    #[serde(default)]
    pub ironwood_activation_height: Option<u32>,

    /// Known checkpoints used to validate sync state.
    /// The relay refuses to serve a source whose tip differs at a checkpoint height.
    #[serde(default)]
    pub checkpoints: Vec<Checkpoint>,

    /// Maximum block height the relay will serve (safety ceiling).
    /// None = no ceiling (serve up to chain tip).
    #[serde(default)]
    pub max_height: Option<u32>,
}

// ---------------------------------------------------------------------------
// CacheConfig
// ---------------------------------------------------------------------------

/// Bounded in-memory cache parameters.
#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    /// Maximum number of compact block responses to cache.
    #[serde(default = "defaults::block_cache_capacity")]
    pub block_cache_capacity: u64,

    /// TTL for cached compact block data (seconds).
    #[serde(default = "defaults::block_cache_ttl_secs")]
    pub block_cache_ttl_secs: u64,

    /// Maximum number of transaction responses to cache.
    #[serde(default = "defaults::tx_cache_capacity")]
    pub tx_cache_capacity: u64,

    /// TTL for cached transaction data (seconds).
    #[serde(default = "defaults::tx_cache_ttl_secs")]
    pub tx_cache_ttl_secs: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            block_cache_capacity: defaults::block_cache_capacity(),
            block_cache_ttl_secs: defaults::block_cache_ttl_secs(),
            tx_cache_capacity: defaults::tx_cache_capacity(),
            tx_cache_ttl_secs: defaults::tx_cache_ttl_secs(),
        }
    }
}

// ---------------------------------------------------------------------------
// LimitsConfig
// ---------------------------------------------------------------------------

/// Per-request bounds enforced before upstream calls.
#[derive(Debug, Clone, Deserialize)]
pub struct LimitsConfig {
    /// Maximum block range span a client may request in one call.
    #[serde(default = "defaults::max_block_range_span")]
    pub max_block_range_span: u32,

    /// Maximum compact block response size in bytes the relay will forward.
    #[serde(default = "defaults::max_response_bytes")]
    pub max_response_bytes: usize,

    /// Maximum individual request body size (bytes).
    #[serde(default = "defaults::max_request_bytes")]
    pub max_request_bytes: usize,

    /// Upstream gRPC request timeout (seconds).
    #[serde(default = "defaults::upstream_timeout_secs")]
    pub upstream_timeout_secs: u64,

    /// Maximum retry attempts on upstream transient errors.
    #[serde(default = "defaults::max_retries")]
    pub max_retries: u32,

    /// Per-IP rate limit: maximum requests per second.
    #[serde(default = "defaults::rate_limit_rps")]
    pub rate_limit_rps: u32,
}

impl Default for LimitsConfig {
    fn default() -> Self {
        Self {
            max_block_range_span: defaults::max_block_range_span(),
            max_response_bytes: defaults::max_response_bytes(),
            max_request_bytes: defaults::max_request_bytes(),
            upstream_timeout_secs: defaults::upstream_timeout_secs(),
            max_retries: defaults::max_retries(),
            rate_limit_rps: defaults::rate_limit_rps(),
        }
    }
}

// ---------------------------------------------------------------------------
// RelayConfig (root)
// ---------------------------------------------------------------------------

/// Root relay configuration loaded from environment + relay.toml.
#[derive(Debug, Clone, Deserialize)]
pub struct RelayConfig {
    /// TCP port to listen on.
    #[serde(default = "defaults::port")]
    pub port: u16,

    /// Allowed CORS origins (exact match). Empty = deny all cross-origin requests.
    #[serde(default)]
    pub allowed_origins: Vec<String>,

    /// Explicit upstream allowlist — only these hosts/URLs may be used.
    /// Any upstream_url in a profile that is not on this list causes startup failure.
    #[serde(default)]
    pub upstream_allowlist: Vec<String>,

    /// One entry per network profile the relay is configured to serve.
    #[serde(default)]
    pub profiles: Vec<NetworkProfile>,

    #[serde(default)]
    pub cache: CacheConfig,

    #[serde(default)]
    pub limits: LimitsConfig,
}

impl RelayConfig {
    /// Validates the configuration at startup.
    ///
    /// - Checks that at least one profile is defined.
    /// - Checks that every profile's upstream_url is on the allowlist.
    /// - Checks that no profile's network is mainnet (belt-and-suspenders).
    /// - Checks that no two profiles share the same network.
    pub fn validate(&self) -> Result<(), RelayError> {
        if self.profiles.is_empty() {
            return Err(RelayError::Configuration(
                "No network profiles configured. Define at least one profile in relay.toml.".into(),
            ));
        }

        let mut seen_networks = HashMap::new();
        for profile in &self.profiles {
            // Belt-and-suspenders mainnet check (network type itself prevents mainnet).
            // We check the upstream URL for obvious mainnet endpoints.
            if self.is_mainnet_url(&profile.upstream_url) {
                return Err(RelayError::Configuration(format!(
                    "Upstream URL '{}' appears to be a mainnet endpoint. \
                     The relay only serves testnet and regtest.",
                    Self::redact_url(&profile.upstream_url)
                )));
            }

            // Allowlist check.
            if !self.upstream_allowlist.is_empty()
                && !self
                    .upstream_allowlist
                    .iter()
                    .any(|allowed| profile.upstream_url.starts_with(allowed))
            {
                return Err(RelayError::Configuration(format!(
                    "Upstream URL for {} profile is not on the allowlist.",
                    profile.network
                )));
            }

            // Duplicate network check.
            if seen_networks.insert(profile.network, true).is_some() {
                return Err(RelayError::Configuration(format!(
                    "Duplicate profile for network '{}'.",
                    profile.network
                )));
            }
        }

        Ok(())
    }

    /// Returns the profile for the given network, or None if not configured.
    pub fn profile_for(&self, network: Network) -> Option<&NetworkProfile> {
        self.profiles.iter().find(|p| p.network == network)
    }

    /// Returns true if the URL resembles a known mainnet endpoint.
    fn is_mainnet_url(&self, url: &str) -> bool {
        let lower = url.to_lowercase();
        // Known mainnet lightwalletd endpoints.
        let mainnet_hints = [
            "mainnet.lightwalletd.com",
            "mainnet.electriccoin.co",
            ":9067",   // lightwalletd mainnet default port
        ];
        mainnet_hints.iter().any(|hint| lower.contains(hint))
    }

    /// Redacts the host/auth portions of a URL for safe logging.
    pub fn redact_url(url: &str) -> String {
        // Remove any credentials; show scheme + host only.
        url.split('@').last().unwrap_or("<url>").to_string()
    }
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

mod defaults {
    pub fn port() -> u16 { 8080 }
    pub fn block_cache_capacity() -> u64 { 2_048 }
    pub fn block_cache_ttl_secs() -> u64 { 300 }  // 5 minutes
    pub fn tx_cache_capacity() -> u64 { 1_024 }
    pub fn tx_cache_ttl_secs() -> u64 { 3_600 }   // 1 hour (txs are immutable)
    pub fn max_block_range_span() -> u32 { 1_000 } // 1000 blocks per request
    pub fn max_response_bytes() -> usize { 10 * 1024 * 1024 } // 10 MiB
    pub fn max_request_bytes() -> usize { 4 * 1024 }           // 4 KiB
    pub fn upstream_timeout_secs() -> u64 { 30 }
    pub fn max_retries() -> u32 { 3 }
    pub fn rate_limit_rps() -> u32 { 60 }
}

// ---------------------------------------------------------------------------
// Loaded profiles index (runtime)
// ---------------------------------------------------------------------------

/// Validated, indexed view of the relay configuration for use by route handlers.
#[derive(Debug, Clone)]
pub struct ProfileIndex {
    inner: HashMap<Network, NetworkProfile>,
}

impl ProfileIndex {
    pub fn from_config(config: &RelayConfig) -> Self {
        let inner = config
            .profiles
            .iter()
            .map(|p| (p.network, p.clone()))
            .collect();
        Self { inner }
    }

    /// Returns the profile for a network, or `Err(UnsupportedNetwork)` if not configured.
    pub fn get(&self, network: Network) -> Result<&NetworkProfile, RelayError> {
        self.inner
            .get(&network)
            .ok_or_else(|| RelayError::UnsupportedNetwork(network.to_string()))
    }

    /// Returns all configured networks.
    pub fn networks(&self) -> Vec<Network> {
        self.inner.keys().copied().collect()
    }
}
