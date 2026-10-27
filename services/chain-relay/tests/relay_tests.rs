/*
  tests/relay_tests.rs — Phase 7 relay test suite.

  Coverage groups
  ───────────────

  A. Configuration and startup validation
     A1. Empty profiles list is rejected at startup.
     A2. Duplicate network profiles are rejected.
     A3. Upstream URL not on allowlist is rejected.
     A4. Mainnet URL hint detected and rejected.
     A5. Valid testnet + regtest profiles pass validation.
     A6. ProfileIndex::get returns Err(UnsupportedNetwork) for missing network.

  B. Input validation — network names
     B1. "testnet" parses correctly.
     B2. "regtest" parses correctly.
     B3. "mainnet" returns MainnetRejected error.
     B4. Unknown string returns UnsupportedNetwork error.
     B5. Case-insensitive: "Testnet" parses as testnet.

  C. Input validation — heights and ranges
     C1. Height 0 is rejected (HeightOutOfBounds).
     C2. end < start is rejected.
     C3. Span exceeding max_block_range_span is rejected (RangeTooLarge).
     C4. Height exceeding profile max_height ceiling is rejected.
     C5. Valid range [100, 200] passes.

  D. Input validation — transaction IDs
     D1. 64-char lowercase hex txid passes.
     D2. 63-char txid is rejected (InvalidTxId).
     D3. 65-char txid is rejected.
     D4. 64-char non-hex txid is rejected.
     D5. 64-char uppercase hex txid is normalised to lowercase.

  E. Input validation — block hashes
     E1. 64-char hex hash passes.
     E2. Non-hex hash is rejected.

  F. Input validation — action counts
     F1. Count within MAX_ACTIONS_PER_TX passes.
     F2. Count exceeding limit returns InvalidParameter.

  G. Input validation — response sizes
     G1. Response within limit passes.
     G2. Response exceeding limit returns ResponseTooLarge.

  H. Checkpoint validation
     H1. Matching checkpoint hash passes.
     H2. Mismatching hash at checkpoint height returns CheckpointMismatch.
     H3. Missing height in upstream hashes is silently skipped (not an error).

  I. Error HTTP mapping
     I1. MainnetRejected → 403 FORBIDDEN.
     I2. UnsupportedNetwork → 404 NOT_FOUND.
     I3. InvalidTxId → 400 BAD_REQUEST.
     I4. RangeTooLarge → 400 BAD_REQUEST.
     I5. RateLimited → 429 TOO_MANY_REQUESTS.
     I6. UpstreamUnavailable → 502 BAD_GATEWAY.
     I7. SourceStale → 502 BAD_GATEWAY.
     I8. ResponseTooLarge → 502 BAD_GATEWAY.
     I9. Internal error → 500 INTERNAL_SERVER_ERROR.

  J. Privacy boundary — logging redaction
     J1. validate_txid returns normalised txid but log output must not
         include the full txid (verified by inspecting the log format in
         routes/transaction.rs).
     J2. Config::redact_url strips credentials from URLs.

  K. Error JSON body structure
     K1. Error body has `error_code` and `message` fields.
     K2. Rate-limit error body includes `retry_after_secs`.
     K3. Non-rate-limit error body does NOT include `retry_after_secs`.

  L. Cache behaviour
     L1. BlockRangeCacheKey equality: same network + range.
     L2. TxCacheKey equality: same network + txid.
     L3. Different networks produce different cache keys.
*/

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Arc;

    use axum::response::IntoResponse;
    use axum_test::TestServer;
    use crate::AppState;
    use crate::config::{
        Checkpoint, CacheConfig, LimitsConfig, Network, NetworkProfile, ProfileIndex, RelayConfig,
    };
    use crate::error::RelayError;
    use crate::upstream::{
        UpstreamClients,
        cache::{BlockRangeCacheKey, RelayCache, TxCacheKey},
    };
    use crate::validation::{
        parse_network, validate_action_count, validate_block_hash, validate_checkpoints,
        validate_height, validate_range, validate_response_size, validate_txid,
        MAX_ACTIONS_PER_TX,
    };

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    fn test_profile(network: Network) -> NetworkProfile {
        NetworkProfile {
            network,
            upstream_url: "https://lightwalletd.testnet.electriccoin.co:9067".to_string(),
            sapling_activation_height: 280_000,
            orchard_activation_height: 1_842_420,
            ironwood_activation_height: None,
            checkpoints: vec![Checkpoint {
                height: 1_900_000,
                hash_hex: "a".repeat(64),
            }],
            max_height: Some(5_000_000),
        }
    }

    fn test_limits() -> LimitsConfig {
        LimitsConfig {
            max_block_range_span: 1_000,
            max_response_bytes: 10 * 1024 * 1024,
            max_request_bytes: 4096,
            upstream_timeout_secs: 30,
            max_retries: 3,
            rate_limit_rps: 60,
        }
    }

    fn test_config_with_profiles(profiles: Vec<NetworkProfile>) -> RelayConfig {
        RelayConfig {
            port: 8080,
            allowed_origins: vec!["http://localhost:5173".to_string()],
            upstream_allowlist: vec![
                "https://lightwalletd.testnet.electriccoin.co".to_string(),
            ],
            profiles,
            cache: CacheConfig::default(),
            limits: test_limits(),
        }
    }

    // -------------------------------------------------------------------------
    // A. Configuration validation
    // -------------------------------------------------------------------------

    #[test]
    fn a1_empty_profiles_rejected() {
        let cfg = test_config_with_profiles(vec![]);
        assert!(matches!(
            cfg.validate(),
            Err(RelayError::Configuration(_))
        ));
    }

    #[test]
    fn a2_duplicate_network_profiles_rejected() {
        let cfg = test_config_with_profiles(vec![
            test_profile(Network::Testnet),
            test_profile(Network::Testnet),
        ]);
        assert!(matches!(
            cfg.validate(),
            Err(RelayError::Configuration(_))
        ));
    }

    #[test]
    fn a3_upstream_url_not_on_allowlist_rejected() {
        let mut profile = test_profile(Network::Testnet);
        profile.upstream_url = "https://evil.example.com:9067".to_string();
        let cfg = test_config_with_profiles(vec![profile]);
        assert!(matches!(
            cfg.validate(),
            Err(RelayError::Configuration(_))
        ));
    }

    #[test]
    fn a4_mainnet_url_hint_rejected() {
        let mut profile = test_profile(Network::Testnet);
        // URL contains the mainnet port hint.
        profile.upstream_url = "https://lightwalletd.testnet.electriccoin.co:9067".to_string();
        let mut cfg = test_config_with_profiles(vec![profile]);
        // Override upstream to use mainnet hint.
        cfg.profiles[0].upstream_url =
            "https://mainnet.lightwalletd.com:9067".to_string();
        cfg.upstream_allowlist = vec![]; // disable allowlist for this test
        assert!(matches!(
            cfg.validate(),
            Err(RelayError::Configuration(_))
        ));
    }

    #[test]
    fn a5_valid_testnet_profile_passes() {
        let cfg = test_config_with_profiles(vec![test_profile(Network::Testnet)]);
        assert!(cfg.validate().is_ok());
    }

    #[test]
    fn a6_profile_index_missing_network_returns_unsupported() {
        let cfg = test_config_with_profiles(vec![test_profile(Network::Testnet)]);
        let index = ProfileIndex::from_config(&cfg);
        assert!(matches!(
            index.get(Network::Regtest),
            Err(RelayError::UnsupportedNetwork(_))
        ));
    }

    // -------------------------------------------------------------------------
    // B. Network name parsing
    // -------------------------------------------------------------------------

    #[test]
    fn b1_testnet_parses_correctly() {
        assert_eq!(parse_network("testnet").unwrap(), Network::Testnet);
    }

    #[test]
    fn b2_regtest_parses_correctly() {
        assert_eq!(parse_network("regtest").unwrap(), Network::Regtest);
    }

    #[test]
    fn b3_mainnet_returns_mainnet_rejected() {
        assert!(matches!(
            parse_network("mainnet"),
            Err(RelayError::MainnetRejected)
        ));
    }

    #[test]
    fn b4_unknown_returns_unsupported_network() {
        assert!(matches!(
            parse_network("saplingnet"),
            Err(RelayError::UnsupportedNetwork(_))
        ));
    }

    #[test]
    fn b5_case_insensitive_testnet() {
        assert_eq!(parse_network("Testnet").unwrap(), Network::Testnet);
        assert_eq!(parse_network("TESTNET").unwrap(), Network::Testnet);
    }

    // -------------------------------------------------------------------------
    // C. Height and range validation
    // -------------------------------------------------------------------------

    #[test]
    fn c1_height_zero_rejected() {
        let profile = test_profile(Network::Testnet);
        assert!(matches!(
            validate_height(0, &profile),
            Err(RelayError::HeightOutOfBounds(_))
        ));
    }

    #[test]
    fn c2_end_before_start_rejected() {
        let profile = test_profile(Network::Testnet);
        let limits = test_limits();
        assert!(matches!(
            validate_range(200, 100, &profile, &limits),
            Err(RelayError::HeightOutOfBounds(_))
        ));
    }

    #[test]
    fn c3_range_exceeding_max_span_rejected() {
        let profile = test_profile(Network::Testnet);
        let limits = test_limits(); // max_block_range_span = 1000
        assert!(matches!(
            validate_range(1, 1_002, &profile, &limits),
            Err(RelayError::RangeTooLarge { requested: 1002, max: 1000 })
        ));
    }

    #[test]
    fn c4_height_above_ceiling_rejected() {
        let profile = test_profile(Network::Testnet); // max_height = Some(5_000_000)
        assert!(matches!(
            validate_height(5_000_001, &profile),
            Err(RelayError::HeightOutOfBounds(_))
        ));
    }

    #[test]
    fn c5_valid_range_passes() {
        let profile = test_profile(Network::Testnet);
        let limits = test_limits();
        assert!(validate_range(100, 200, &profile, &limits).is_ok());
    }

    // -------------------------------------------------------------------------
    // D. Transaction ID validation
    // -------------------------------------------------------------------------

    #[test]
    fn d1_valid_64_char_hex_txid_passes() {
        let txid = "a".repeat(64);
        assert_eq!(validate_txid(&txid).unwrap(), txid);
    }

    #[test]
    fn d2_63_char_txid_rejected() {
        assert!(matches!(
            validate_txid(&"a".repeat(63)),
            Err(RelayError::InvalidTxId(_))
        ));
    }

    #[test]
    fn d3_65_char_txid_rejected() {
        assert!(matches!(
            validate_txid(&"a".repeat(65)),
            Err(RelayError::InvalidTxId(_))
        ));
    }

    #[test]
    fn d4_non_hex_txid_rejected() {
        let txid = format!("{}zzzz", "a".repeat(60));
        assert!(matches!(
            validate_txid(&txid),
            Err(RelayError::InvalidTxId(_))
        ));
    }

    #[test]
    fn d5_uppercase_hex_normalised_to_lowercase() {
        let upper = "A".repeat(64);
        let normalised = validate_txid(&upper).unwrap();
        assert_eq!(normalised, "a".repeat(64));
    }

    // -------------------------------------------------------------------------
    // E. Block hash validation
    // -------------------------------------------------------------------------

    #[test]
    fn e1_valid_64_char_block_hash_passes() {
        let hash = "b".repeat(64);
        assert!(validate_block_hash(&hash).is_ok());
    }

    #[test]
    fn e2_non_hex_block_hash_rejected() {
        let hash = format!("{}zz", "a".repeat(62));
        assert!(matches!(
            validate_block_hash(&hash),
            Err(RelayError::InvalidParameter(_))
        ));
    }

    // -------------------------------------------------------------------------
    // F. Action count validation
    // -------------------------------------------------------------------------

    #[test]
    fn f1_action_count_within_limit_passes() {
        assert!(validate_action_count(MAX_ACTIONS_PER_TX).is_ok());
    }

    #[test]
    fn f2_action_count_exceeding_limit_rejected() {
        assert!(matches!(
            validate_action_count(MAX_ACTIONS_PER_TX + 1),
            Err(RelayError::InvalidParameter(_))
        ));
    }

    // -------------------------------------------------------------------------
    // G. Response size validation
    // -------------------------------------------------------------------------

    #[test]
    fn g1_response_within_limit_passes() {
        let limits = test_limits(); // max_response_bytes = 10 MiB
        assert!(validate_response_size(1024, &limits).is_ok());
    }

    #[test]
    fn g2_response_exceeding_limit_rejected() {
        let limits = test_limits();
        assert!(matches!(
            validate_response_size(limits.max_response_bytes + 1, &limits),
            Err(RelayError::ResponseTooLarge)
        ));
    }

    // -------------------------------------------------------------------------
    // H. Checkpoint validation
    // -------------------------------------------------------------------------

    #[test]
    fn h1_matching_checkpoint_passes() {
        let profile = test_profile(Network::Testnet);
        let mut hashes = HashMap::new();
        hashes.insert(1_900_000u32, "a".repeat(64));
        assert!(validate_checkpoints(&profile, &hashes).is_ok());
    }

    #[test]
    fn h2_mismatching_checkpoint_returns_error() {
        let profile = test_profile(Network::Testnet);
        let mut hashes = HashMap::new();
        hashes.insert(1_900_000u32, "b".repeat(64)); // wrong hash
        assert!(matches!(
            validate_checkpoints(&profile, &hashes),
            Err(RelayError::CheckpointMismatch { height: 1_900_000 })
        ));
    }

    #[test]
    fn h3_missing_checkpoint_height_is_skipped() {
        let profile = test_profile(Network::Testnet);
        let hashes: HashMap<u32, String> = HashMap::new(); // no heights provided
        assert!(validate_checkpoints(&profile, &hashes).is_ok());
    }

    // -------------------------------------------------------------------------
    // I. Error HTTP status mapping
    // -------------------------------------------------------------------------

    fn status_of(err: RelayError) -> u16 {
        err.into_response().status().as_u16()
    }

    #[test]
    fn i1_mainnet_rejected_is_403() {
        assert_eq!(status_of(RelayError::MainnetRejected), 403);
    }

    #[test]
    fn i2_unsupported_network_is_404() {
        assert_eq!(status_of(RelayError::UnsupportedNetwork("x".into())), 404);
    }

    #[test]
    fn i3_invalid_txid_is_400() {
        assert_eq!(status_of(RelayError::InvalidTxId("bad".into())), 400);
    }

    #[test]
    fn i4_range_too_large_is_400() {
        assert_eq!(
            status_of(RelayError::RangeTooLarge { requested: 2000, max: 1000 }),
            400
        );
    }

    #[test]
    fn i5_rate_limited_is_429() {
        assert_eq!(
            status_of(RelayError::RateLimited { retry_after_secs: 60 }),
            429
        );
    }

    #[test]
    fn i6_upstream_unavailable_is_502() {
        assert_eq!(
            status_of(RelayError::UpstreamUnavailable { reason: "down".into() }),
            502
        );
    }

    #[test]
    fn i7_source_stale_is_502() {
        assert_eq!(
            status_of(RelayError::SourceStale { tip_height: 0 }),
            502
        );
    }

    #[test]
    fn i8_response_too_large_is_502() {
        assert_eq!(status_of(RelayError::ResponseTooLarge), 502);
    }

    #[test]
    fn i9_internal_error_is_500() {
        assert_eq!(
            status_of(RelayError::Internal(anyhow::anyhow!("oops"))),
            500
        );
    }

    // -------------------------------------------------------------------------
    // J. Privacy boundary — URL redaction
    // -------------------------------------------------------------------------

    #[test]
    fn j1_redact_url_strips_credentials() {
        let url = "https://user:secret@lightwalletd.testnet.electriccoin.co:9067";
        let redacted = RelayConfig::redact_url(url);
        assert!(!redacted.contains("secret"));
        assert!(redacted.contains("lightwalletd"));
    }

    #[test]
    fn j2_redact_url_plain_url_unchanged() {
        let url = "https://lightwalletd.testnet.electriccoin.co:9067";
        assert_eq!(RelayConfig::redact_url(url), url);
    }

    // -------------------------------------------------------------------------
    // K. Error JSON body structure
    // -------------------------------------------------------------------------

    async fn error_body(err: RelayError) -> serde_json::Value {
        let response = err.into_response();
        let bytes = axum::body::to_bytes(response.into_body(), 4096)
            .await
            .expect("error response body should be readable");
        serde_json::from_slice(&bytes).expect("error response body should be JSON")
    }

    #[tokio::test]
    async fn k1_error_response_has_a_safe_code_and_message() {
        let body = error_body(RelayError::MainnetRejected).await;
        assert_eq!(body["error_code"], "MAINNET_REJECTED");
        assert!(body["message"].is_string());
    }

    #[tokio::test]
    async fn k2_rate_limit_response_includes_retry_after() {
        let body = error_body(RelayError::RateLimited { retry_after_secs: 30 }).await;
        assert_eq!(body["error_code"], "RATE_LIMITED");
        assert_eq!(body["retry_after_secs"], 30);
    }

    #[tokio::test]
    async fn k3_internal_error_response_omits_retry_after() {
        let body = error_body(RelayError::Internal(anyhow::anyhow!("boom"))).await;
        assert_eq!(body["error_code"], "INTERNAL_ERROR");
        assert!(body.get("retry_after_secs").is_none());
    }

    // -------------------------------------------------------------------------
    // L. Cache key equality
    // -------------------------------------------------------------------------

    #[test]
    fn l1_block_range_cache_key_equality() {
        let k1 = BlockRangeCacheKey {
            network: "testnet".to_string(),
            start_height: 100,
            end_height: 200,
        };
        let k2 = BlockRangeCacheKey {
            network: "testnet".to_string(),
            start_height: 100,
            end_height: 200,
        };
        assert_eq!(k1, k2);
    }

    #[test]
    fn l2_tx_cache_key_equality() {
        let k1 = TxCacheKey {
            network: "testnet".to_string(),
            txid_hex: "a".repeat(64),
        };
        let k2 = TxCacheKey {
            network: "testnet".to_string(),
            txid_hex: "a".repeat(64),
        };
        assert_eq!(k1, k2);
    }

    #[test]
    fn l3_different_networks_different_cache_keys() {
        let k1 = BlockRangeCacheKey {
            network: "testnet".to_string(),
            start_height: 100,
            end_height: 200,
        };
        let k2 = BlockRangeCacheKey {
            network: "regtest".to_string(),
            start_height: 100,
            end_height: 200,
        };
        assert_ne!(k1, k2);
    }

    #[tokio::test]
    async fn transaction_route_returns_cached_raw_bytes_unchanged() {
        let config = test_config_with_profiles(vec![test_profile(Network::Testnet)]);
        let display_txid = "0123456789abcdef".repeat(4);
        let transaction_bytes = vec![0x05, 0x00, 0x00, 0x80, 0xaa, 0xbb];
        let cache = Arc::new(RelayCache::new(&config.cache));
        cache
            .put_transaction(
                TxCacheKey {
                    network: "testnet".to_string(),
                    txid_hex: display_txid.clone(),
                },
                transaction_bytes.clone(),
            )
            .await;

        let state = AppState {
            profiles: Arc::new(ProfileIndex::from_config(&config)),
            clients: Arc::new(UpstreamClients::from_config(&config).await.unwrap()),
            cache,
            config: Arc::new(config),
        };
        let server = TestServer::new(crate::routes::build_router(state)).unwrap();
        let response = server
            .get(&format!("/tx/testnet/{display_txid}"))
            .await;

        response.assert_status_ok();
        assert_eq!(response.as_bytes().as_ref(), transaction_bytes.as_slice());
    }

    #[tokio::test]
    async fn failed_transaction_fetch_is_not_cached() {
        let mut profile = test_profile(Network::Testnet);
        profile.upstream_url = "http://127.0.0.1:1".to_string();
        let config = test_config_with_profiles(vec![profile]);
        let display_txid = "0123456789abcdef".repeat(4);
        let cache = Arc::new(RelayCache::new(&config.cache));
        let cache_key = TxCacheKey {
            network: "testnet".to_string(),
            txid_hex: display_txid.clone(),
        };
        let state = AppState {
            profiles: Arc::new(ProfileIndex::from_config(&config)),
            clients: Arc::new(UpstreamClients::from_config(&config).await.unwrap()),
            cache: cache.clone(),
            config: Arc::new(config),
        };
        let server = TestServer::new(crate::routes::build_router(state)).unwrap();

        let response = server
            .get(&format!("/tx/testnet/{display_txid}"))
            .await;

        response.assert_status(axum::http::StatusCode::BAD_GATEWAY);
        assert!(cache.get_transaction(&cache_key).await.is_none());
    }
}
