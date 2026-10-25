/*
  upstream/cache.rs — Bounded in-memory cache for public chain data.

  Caches only public data (compact block bytes, transaction bytes).
  No private data (keys, labels, amounts, memos) is ever cached here.

  The cache is keyed by (network, height) for block ranges and by
  (network, txid_hex) for transactions. Both are public data.

  Cache entries have a TTL. Compact blocks expire after 5 minutes by default;
  transaction bytes expire after 1 hour (transactions are immutable once confirmed).

  The cache capacity is bounded — entries are evicted on a size-and-time
  policy by `moka` so memory growth is controlled.
*/

use std::time::Duration;

use moka::future::Cache;

use crate::config::CacheConfig;

// ---------------------------------------------------------------------------
// Cache keys
// ---------------------------------------------------------------------------

/// Key for a compact block range response.
/// Keyed by network string + start height + end height.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct BlockRangeCacheKey {
    pub network: String,
    pub start_height: u32,
    pub end_height: u32,
}

/// Key for a single transaction.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct TxCacheKey {
    pub network: String,
    /// Lowercase 64-char hex transaction ID.
    pub txid_hex: String,
}

// ---------------------------------------------------------------------------
// RelayCache
// ---------------------------------------------------------------------------

#[derive(Clone)]
pub struct RelayCache {
    /// Compact block range cache: key → hex-encoded compact block bytes.
    pub blocks: Cache<BlockRangeCacheKey, Vec<u8>>,
    /// Transaction cache: key → raw transaction bytes.
    pub transactions: Cache<TxCacheKey, Vec<u8>>,
}

impl RelayCache {
    pub fn new(cfg: &CacheConfig) -> Self {
        let blocks = Cache::builder()
            .max_capacity(cfg.block_cache_capacity)
            .time_to_live(Duration::from_secs(cfg.block_cache_ttl_secs))
            .build();

        let transactions = Cache::builder()
            .max_capacity(cfg.tx_cache_capacity)
            .time_to_live(Duration::from_secs(cfg.tx_cache_ttl_secs))
            .build();

        Self { blocks, transactions }
    }

    // ---- Block range cache --------------------------------------------------

    pub async fn get_blocks(&self, key: &BlockRangeCacheKey) -> Option<Vec<u8>> {
        self.blocks.get(key).await
    }

    pub async fn put_blocks(&self, key: BlockRangeCacheKey, data: Vec<u8>) {
        self.blocks.insert(key, data).await;
    }

    // ---- Transaction cache --------------------------------------------------

    pub async fn get_transaction(&self, key: &TxCacheKey) -> Option<Vec<u8>> {
        self.transactions.get(key).await
    }

    pub async fn put_transaction(&self, key: TxCacheKey, data: Vec<u8>) {
        self.transactions.insert(key, data).await;
    }
}
