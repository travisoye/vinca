/*
  error.rs — Typed relay error contract.

  All public route handlers return `Result<_, RelayError>`. The `IntoResponse`
  impl maps each variant to a precise HTTP status code and a structured JSON
  error body that clients can pattern-match on.

  Privacy notes
  ─────────────
  • The `error_code` field in the JSON response body never includes private
    data (keys, labels, amounts, memos, passphrases or raw request bodies).
  • The `message` field is always operator-authored or derived from safe
    validated inputs. It never echoes unvalidated client input directly.
  • `Upstream` errors are summarised, not forwarded verbatim, to avoid leaking
    internal network topology or upstream error messages to browser clients.
*/

use axum::{
    http::StatusCode,
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum RelayError {
    // --- Request validation errors (4xx) ------------------------------------

    /// Mainnet requests are unconditionally rejected.
    #[error("Mainnet is not supported. This relay serves testnet and regtest only.")]
    MainnetRejected,

    /// A network name was not recognised or is not configured for this relay.
    #[error("Unsupported or unconfigured network: {0}")]
    UnsupportedNetwork(String),

    /// A height or range was outside the accepted bounds.
    #[error("Height out of bounds: {0}")]
    HeightOutOfBounds(String),

    /// A block range span exceeded the per-request limit.
    #[error("Block range span too large: requested {requested}, max {max}")]
    RangeTooLarge { requested: u32, max: u32 },

    /// A transaction ID was malformed (wrong length, non-hex, etc.).
    #[error("Invalid transaction ID: {0}")]
    InvalidTxId(String),

    /// A request parameter was malformed.
    #[error("Invalid request parameter: {0}")]
    InvalidParameter(String),

    /// Request body exceeded the size limit.
    #[error("Request too large")]
    RequestTooLarge,

    // --- Rate limiting (429) -------------------------------------------------

    #[error("Rate limit exceeded. Retry after {retry_after_secs}s.")]
    RateLimited { retry_after_secs: u64 },

    // --- Source/upstream errors (502/504) ------------------------------------

    /// The upstream lightwalletd node is unavailable or not yet synced.
    #[error("Upstream unavailable: {reason}")]
    UpstreamUnavailable { reason: String },

    /// The upstream source is stale (tip has not advanced recently).
    #[error("Source is stale: last known tip at height {tip_height}")]
    SourceStale { tip_height: u32 },

    /// A checkpoint mismatch was detected (possible fork or misconfiguration).
    #[error("Checkpoint mismatch at height {height}: sync state diverged")]
    CheckpointMismatch { height: u32 },

    /// The upstream returned an unexpected format or incompatible version.
    #[error("Upstream returned unsupported format: {0}")]
    UnsupportedFormat(String),

    /// A response size exceeded the configured safety ceiling.
    #[error("Response too large from upstream")]
    ResponseTooLarge,

    // --- Server errors (500) -------------------------------------------------

    #[error("Configuration error: {0}")]
    Configuration(String),

    #[error("Internal relay error")]
    Internal(#[source] anyhow::Error),
}

// ---------------------------------------------------------------------------
// JSON error body
// ---------------------------------------------------------------------------

#[derive(Serialize)]
struct ErrorBody {
    error_code: &'static str,
    message: String,
    /// Included only for rate-limit responses.
    #[serde(skip_serializing_if = "Option::is_none")]
    retry_after_secs: Option<u64>,
}

// ---------------------------------------------------------------------------
// HTTP status mapping
// ---------------------------------------------------------------------------

impl RelayError {
    fn status_code(&self) -> StatusCode {
        match self {
            RelayError::MainnetRejected => StatusCode::FORBIDDEN,
            RelayError::UnsupportedNetwork(_) => StatusCode::NOT_FOUND,
            RelayError::HeightOutOfBounds(_) => StatusCode::BAD_REQUEST,
            RelayError::RangeTooLarge { .. } => StatusCode::BAD_REQUEST,
            RelayError::InvalidTxId(_) => StatusCode::BAD_REQUEST,
            RelayError::InvalidParameter(_) => StatusCode::BAD_REQUEST,
            RelayError::RequestTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
            RelayError::RateLimited { .. } => StatusCode::TOO_MANY_REQUESTS,
            RelayError::UpstreamUnavailable { .. } => StatusCode::BAD_GATEWAY,
            RelayError::SourceStale { .. } => StatusCode::BAD_GATEWAY,
            RelayError::CheckpointMismatch { .. } => StatusCode::BAD_GATEWAY,
            RelayError::UnsupportedFormat(_) => StatusCode::BAD_GATEWAY,
            RelayError::ResponseTooLarge => StatusCode::BAD_GATEWAY,
            RelayError::Configuration(_) => StatusCode::INTERNAL_SERVER_ERROR,
            RelayError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    fn error_code(&self) -> &'static str {
        match self {
            RelayError::MainnetRejected => "MAINNET_REJECTED",
            RelayError::UnsupportedNetwork(_) => "UNSUPPORTED_NETWORK",
            RelayError::HeightOutOfBounds(_) => "HEIGHT_OUT_OF_BOUNDS",
            RelayError::RangeTooLarge { .. } => "RANGE_TOO_LARGE",
            RelayError::InvalidTxId(_) => "INVALID_TX_ID",
            RelayError::InvalidParameter(_) => "INVALID_PARAMETER",
            RelayError::RequestTooLarge => "REQUEST_TOO_LARGE",
            RelayError::RateLimited { .. } => "RATE_LIMITED",
            RelayError::UpstreamUnavailable { .. } => "UPSTREAM_UNAVAILABLE",
            RelayError::SourceStale { .. } => "SOURCE_STALE",
            RelayError::CheckpointMismatch { .. } => "CHECKPOINT_MISMATCH",
            RelayError::UnsupportedFormat(_) => "UNSUPPORTED_FORMAT",
            RelayError::ResponseTooLarge => "RESPONSE_TOO_LARGE",
            RelayError::Configuration(_) => "CONFIGURATION_ERROR",
            RelayError::Internal(_) => "INTERNAL_ERROR",
        }
    }
}

impl IntoResponse for RelayError {
    fn into_response(self) -> Response {
        let status = self.status_code();
        let retry_after = if let RelayError::RateLimited { retry_after_secs } = &self {
            Some(*retry_after_secs)
        } else {
            None
        };

        // Internal errors: log the cause but show a generic message to clients.
        if let RelayError::Internal(ref cause) = self {
            tracing::error!(error = %cause, "Internal relay error");
        }

        let body = ErrorBody {
            error_code: self.error_code(),
            // Safe: the Display impl never includes unvalidated client input.
            message: self.to_string(),
            retry_after_secs: retry_after,
        };

        (status, Json(body)).into_response()
    }
}

// ---------------------------------------------------------------------------
// From conversions
// ---------------------------------------------------------------------------

impl From<anyhow::Error> for RelayError {
    fn from(err: anyhow::Error) -> Self {
        RelayError::Internal(err)
    }
}

impl From<tonic::Status> for RelayError {
    fn from(status: tonic::Status) -> Self {
        use tonic::Code;
        match status.code() {
            Code::Unavailable | Code::DeadlineExceeded | Code::Aborted => {
                RelayError::UpstreamUnavailable {
                    // Summarise only the gRPC code; do not forward the full message.
                    reason: format!("gRPC status: {}", status.code()),
                }
            }
            Code::ResourceExhausted => RelayError::RateLimited { retry_after_secs: 60 },
            Code::NotFound => RelayError::UpstreamUnavailable {
                reason: "Resource not found on upstream".into(),
            },
            _ => RelayError::Internal(anyhow::anyhow!("gRPC error: {}", status.code())),
        }
    }
}
