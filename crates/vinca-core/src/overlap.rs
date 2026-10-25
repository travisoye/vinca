//! Overlap and duplication analysis between viewing contexts.
//!
//! Non-negotiable boundary:
//! "Detect duplicate complete components and overlapping incoming decryption scalars,
//! including equal ivk with different dk. Report shared diversifier material separately
//! from identical decryption access."

use crate::types::{OverlapKind, OverlapReport, PoolKind, RetainedOrchardKey};
use subtle::ConstantTimeEq;

/// Compares two retained Orchard keys and classifies their overlap.
pub fn compare_orchard_keys(
    key_a: &RetainedOrchardKey,
    key_b: &RetainedOrchardKey,
) -> OverlapReport {
    let same_ivk = bool::from(key_a.ivk.ct_eq(&key_b.ivk));
    let same_dk = bool::from(key_a.dk.ct_eq(&key_b.dk));

    if same_ivk && same_dk {
        OverlapReport {
            kind: OverlapKind::IdenticalKey,
            summary: "Identical incoming viewing capability on both Orchard and Ironwood pools.".into(),
            shared_pools: vec![PoolKind::Orchard, PoolKind::Ironwood],
            cautions: vec![
                "Both contexts hold the identical cryptographic viewing key.".into(),
                "All past and future payments visible to one context are visible to the other.".into(),
            ],
        }
    } else if same_ivk {
        OverlapReport {
            kind: OverlapKind::IdenticalDecryptionScalar,
            summary: "Shared incoming decryption scalar (ivk) with different diversifier keys (dk).".into(),
            shared_pools: vec![PoolKind::Orchard, PoolKind::Ironwood],
            cautions: vec![
                "Both keys decrypt the exact same incoming payments despite generating different addresses.".into(),
                "Sharing this context grants full access to all payments covered by the same decryption scalar.".into(),
            ],
        }
    } else if same_dk {
        OverlapReport {
            kind: OverlapKind::SharedDiversifierKey,
            summary: "Shared diversifier key (dk) with distinct incoming decryption scalars (ivk).".into(),
            shared_pools: vec![],
            cautions: vec![
                "Both keys generate correlated addresses from the same diversifier material.".into(),
                "Neither key can decrypt payments received by the other key's addresses.".into(),
            ],
        }
    } else {
        OverlapReport {
            kind: OverlapKind::Disjoint,
            summary: "Completely disjoint incoming viewing capabilities.".into(),
            shared_pools: vec![],
            cautions: vec![],
        }
    }
}
