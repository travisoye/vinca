/*
  routes/profiles.rs — GET /profiles

  Returns the list of network profiles configured for this relay instance.
  Only public, non-secret fields are included in the response:
    • Network name
    • Activation heights
    • Checkpoint heights (but NOT hashes — hashes are operator-internal)

  The upstream endpoint URLs and TLS configuration are NEVER included in
  the response; they are operator-internal configuration.
*/

use axum::{extract::State, response::Json};
use serde::Serialize;

use crate::AppState;
use crate::config::NetworkProfile;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
pub struct ProfilesResponse {
    pub profiles: Vec<PublicProfile>,
}

#[derive(Serialize)]
pub struct PublicProfile {
    pub network: String,
    pub sapling_activation_height: u32,
    pub orchard_activation_height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ironwood_activation_height: Option<u32>,
    /// Heights of configured checkpoints (public knowledge; hashes are internal).
    pub checkpoint_heights: Vec<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_height: Option<u32>,
}

impl From<&NetworkProfile> for PublicProfile {
    fn from(profile: &NetworkProfile) -> Self {
        Self {
            network: profile.network.to_string(),
            sapling_activation_height: profile.sapling_activation_height,
            orchard_activation_height: profile.orchard_activation_height,
            ironwood_activation_height: profile.ironwood_activation_height,
            checkpoint_heights: profile.checkpoints.iter().map(|c| c.height).collect(),
            max_height: profile.max_height,
        }
    }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/// GET /profiles — returns all publicly-available profile metadata.
pub async fn list_profiles(State(state): State<AppState>) -> Json<ProfilesResponse> {
    let networks = state.profiles.networks();
    let profiles = networks
        .iter()
        .filter_map(|n| state.profiles.get(*n).ok().map(PublicProfile::from))
        .collect();

    Json(ProfilesResponse { profiles })
}
