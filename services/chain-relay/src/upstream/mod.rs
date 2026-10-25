/*
  upstream/mod.rs — Upstream client registry.

  Holds one LightwalletdClient per configured network profile.
  Constructed once at startup from the validated RelayConfig and shared as
  Axum extension state.
*/

pub mod cache;
pub mod lightwalletd;

use std::collections::HashMap;

use crate::config::{Network, RelayConfig};
use crate::error::RelayError;
use self::lightwalletd::LightwalletdClient;

/// Per-network upstream client set.
#[derive(Clone)]
pub struct UpstreamClients {
    inner: HashMap<String, LightwalletdClient>,
}

impl UpstreamClients {
    /// Constructs one client per configured profile.
    /// Connections are lazy; errors surface on the first actual RPC call.
    pub async fn from_config(config: &RelayConfig) -> Result<Self, RelayError> {
        let mut inner = HashMap::new();
        for profile in &config.profiles {
            let client =
                LightwalletdClient::connect(&profile.upstream_url, &config.limits).await?;
            inner.insert(profile.network.to_string(), client);
        }
        Ok(Self { inner })
    }

    /// Returns the client for the given network.
    pub fn get(&self, network: Network) -> Result<&LightwalletdClient, RelayError> {
        self.inner
            .get(&network.to_string())
            .ok_or_else(|| RelayError::UnsupportedNetwork(network.to_string()))
    }
}
