/*
  Vinca frontend presentation contracts.

  These types describe what the interface renders. They are presentation
  contracts only: none of this code performs key parsing, protocol
  inspection, encryption, live scanning or persistence (prd.md phase 1).

  Money is represented exactly, never as a floating-point number:
  amounts are integer zatoshis transported as decimal strings
  (prd.md cross-phase requirements).
*/

/** Vinca supports testnet and reproducible regtest only. Mainnet encodings are rejected and never enter this domain. */
export type Network = "testnet" | "regtest";

/** Native Orchard-family pools covered by an imported incoming capability. */
export type PoolKind = "orchard" | "ironwood";

/**
 * Pool kinds that may appear in an imported key or file but that Vinca does not
 * retain for inspection. They are always declared in the interface, never silently dropped.
 */
export type UnsupportedPoolKind = "sapling" | "transparent";

/** Exact amount in integer zatoshis, transported as a decimal string. */
export type Zatoshis = `${number}`;

/**
 * A contiguous, inclusive block range that was actually inspected.
 */
export interface CoverageRange {
  readonly startHeight: number;
  readonly endHeight: number;
}

/**
 * Where the presented data came from. Phase 1 fixtures use `fixture-sample`
 * exclusively; later phases introduce offline dataset and live local scanning.
 */
export type ScanSource = "fixture-sample" | "offline-dataset" | "live-local-scan";

/**
 * Evidence level shown beside a receipt. Sample data can never carry a
 * live-chain verification badge (prd.md phase 3).
 */
export type EvidenceLevel =
  | /** Bundled presentation fixture. Not a protocol result. */ "fixture-sample"
  /** A record produced by local inspection in a later phase. */
  | "locally-inspected"
  /** An amount and memo asserted by an exporter inside a record snapshot; not independently verifiable. */
  | "exported-assertion";

/**
 * Memo retrieval is explicit and on-demand. `available` means a transaction
 * containing the memo has already been locally obtained (offline import or a
 * previously approved fetch); it is never fetched automatically.
 */
export type MemoState =
  | { readonly state: "not-requested" }
  | { readonly state: "available"; readonly format: "text" | "arbitrary-bytes"; readonly text: string }
  | { readonly state: "unavailable"; readonly reason: string };

/**
 * Actual coverage state for a context. Ranges are the honest record of what was
 * inspected, including gaps; `stale` means the tip has moved beyond the scan.
 */
export interface CoverageReport {
  readonly source: ScanSource;
  readonly birthdayHeight: number;
  readonly scannedRanges: readonly CoverageRange[];
  /** Gaps between the birthday and the last scanned height that were never inspected. */
  readonly gaps: readonly CoverageRange[];
  readonly lastScannedHeight: number | null;
  /** Current chain tip as reported by the source, when known. */
  readonly tipHeight: number | null;
  readonly stale: boolean;
  /** Scanner protocol version that produced these ranges; absent on legacy records. */
  readonly scannerVersion?: number;
  /** Reorganization or rollback notice when chain tip ancestor changes. */
  readonly reorgNotice?: {
    readonly rollbackHeight: number;
    readonly detectedAtUtc: string;
    readonly reason: string;
  } | null;
}

/**
 * A context is an imported incoming capability with validated receiver and
 * network metadata, a birthday and a coverage state. Its label does not
 * establish account ownership or provenance.
 */
export interface ContextSummary {
  readonly id: string;
  readonly label: string;
  readonly network: Network;
  readonly birthdayHeight: number;
  readonly status: "active" | "archived";
  /** Supported native Orchard-family receivers retained for inspection. */
  readonly supportedPools: readonly PoolKind[];
  /** Declared components that are known but not retained for inspection. */
  readonly unsupportedComponents: readonly UnsupportedPoolKind[];
  /** Other local contexts sharing complete incoming capability (at least in part). */
  readonly overlappingContextIds: readonly string[];
  readonly coverage: CoverageReport;
  readonly receiptCount: number;
  readonly createdAtUtc: string;
  /** Optional user-supplied note; never a provenance claim. */
  readonly note: string | null;
}

/**
 * A receipt is a locally decrypted incoming note with source, network, pool,
 * output identifiers and an exact amount. It is not a spendable balance.
 */
export interface Receipt {
  readonly id: string;
  readonly contextId: string;
  readonly network: Network;
  readonly pool: PoolKind;
  /** Hex transaction id of the containing transaction. */
  readonly txIdHex: string;
  /** Index of the output or action within the transaction. */
  readonly actionIndex: number;
  readonly recipientAddress: string | null;
  readonly amountZatoshis: Zatoshis;
  readonly blockHeight: number;
  /** Best-effort timestamp from the source; null when the source does not provide one. */
  readonly observedUtc: string | null;
  readonly evidence: EvidenceLevel;
  readonly memo: MemoState;
}

export type DisclosureKind = "context-access-package" | "record-snapshot";

export type DisclosureWarningCode =
  /** The recipient will be able to inspect matching past and future receipts. */
  | "continuing-access"
  /** Archiving, deletion, expiry or a new passphrase cannot revoke a copy already held. */
  | "irrevocable-holder-copy"
  /** A date or pool/address filter is not a cryptographic restriction on an exported key. */
  | "filter-not-cryptographic"
  /** Snapshot amounts and memos are exporter-provided information, not independently verified proof. */
  | "private-amount-not-proof"
  /** The snapshot includes memo fields the recipient will see. */
  | "memo-included"
  /** A record snapshot was requested with no records selected. */
  | "empty-selection"
  /** The capability also covered components that are not part of this export. */
  | "mixed-components-not-shared";

export interface DisclosureWarning {
  readonly code: DisclosureWarningCode;
  readonly message: string;
}

/**
 * What the interface shows before an export is prepared. Phase 1 fixtures
 * produce previews only; no encrypted file is generated until later phases.
 */
export interface DisclosurePreview {
  readonly kind: DisclosureKind;
  readonly contextId: string;
  readonly selectedReceiptIds: readonly string[];
  readonly includesViewingKey: boolean;
  readonly includesMemos: boolean;
  readonly warnings: readonly DisclosureWarning[];
}

export interface DisclosurePreviewRequest {
  readonly kind: DisclosureKind;
  readonly contextId: string;
  readonly selectedReceiptIds: readonly string[];
  readonly includeMemos: boolean;
}

/**
 * Workspace lifecycle as seen by the interface. Phase 1 models it in memory
 * with a fixture passphrase; the real encrypted vault arrives in phase 6.
 */
export type WorkspacePhase = "no-vault" | "locked" | "unlocked";

/**
 * Generic loadable state for interface regions, with an explicit cancelled
 * state required by prd.md phase 1 (cancellation states must be finished in
 * the UI before backend work).
 */
export type Loadable<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: T }
  | { readonly status: "error"; readonly message: string; readonly retryable: boolean }
  | { readonly status: "cancelled" };

/**
 * Record of a previously prepared disclosure package in this local workspace.
 */
export interface DisclosureHistoryItem {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly kind: DisclosureKind;
  readonly contextId: string;
  readonly contextLabel: string;
  readonly selectedReceiptIds: readonly string[];
  readonly recordCount: number;
  readonly memoIncluded: boolean;
  readonly recipientNote?: string;
}
