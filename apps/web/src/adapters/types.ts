/*
  Presentation port interfaces & finalized service contracts (PRD Phases 1–4).
  These typed contracts establish the exact boundary for Phase 5 (WASM worker),
  Phase 6 (encrypted vault), and Phase 7 (public relay), ensuring no frontend
  redesign will be required when real services are integrated behind them.
*/

export type {
  MemoData,
  MemoFormat,
} from "@/types";

import type {
  ContextSummary,
  CoverageRange,
  DisclosurePreview,
  DisclosurePreviewRequest,
  MemoData,
  Network,
  PoolKind,
  Receipt,
  UnsupportedPoolKind,
} from "@/types";

/** Opaque handle referring to a viewing key held inside the WASM worker memory. */
export type OpaqueKeyHandle = string & { readonly __brand: unique symbol };

/** Raw encrypted payload stored in IndexedDB. */
export interface EncryptedPayload {
  readonly nonceHex: string;
  readonly ciphertextHex: string;
  readonly aadHex: string;
}

// ---------------------------------------------------------------------------
// Presentation Ports (Active during Phases 1–4)
// ---------------------------------------------------------------------------

export interface VincaContextPort {
  listContexts(): Promise<readonly ContextSummary[]>;
  getContext(id: string): Promise<ContextSummary | null>;
  listReceipts(contextId: string): Promise<readonly Receipt[]>;
}

export interface VincaDisclosurePort {
  preview(request: DisclosurePreviewRequest): Promise<DisclosurePreview>;
}

export interface VincaPorts {
  readonly contexts: VincaContextPort;
  readonly disclosures: VincaDisclosurePort;
}

// ---------------------------------------------------------------------------
// Finalized Phase 5 Service Contracts: Protocol Core & WASM Worker
// ---------------------------------------------------------------------------

export interface WorkerDecodedKeyResult {
  readonly handle: OpaqueKeyHandle;
  readonly network: Network;
  readonly retainedPools: readonly PoolKind[];
  readonly declaredUnretained: readonly UnsupportedPoolKind[];
}

export interface WorkerScanResult {
  readonly inspectedRange: CoverageRange;
  readonly decryptedReceipts: readonly Receipt[];
  readonly reorgDetected: boolean;
  readonly commonAncestorHeight?: number;
}

export interface WorkerDecryptedMemoResult extends MemoData {
  readonly rawBytesHex: string;
}

export interface VincaWorkerPort {
  /** Decodes a raw UIVK file into an opaque handle. Rejects UFVK, spending keys, and mainnet. */
  decodeUivk(rawBytes: Uint8Array, network: Network): Promise<WorkerDecodedKeyResult>;
  /** Scans compact blocks locally in the worker. */
  scanRange(handle: OpaqueKeyHandle, range: CoverageRange, compactBlocks: Uint8Array): Promise<WorkerScanResult>;
  /** Decrypts an explicit memo using the opaque key handle and full transaction bytes. */
  decryptMemo(handle: OpaqueKeyHandle, txBytes: Uint8Array, receipt: Receipt): Promise<WorkerDecryptedMemoResult>;
  /** Safely discards and zeroises key material in worker memory. */
  destroyHandle(handle: OpaqueKeyHandle): Promise<void>;
}

// ---------------------------------------------------------------------------
// Finalized Phase 6 Service Contracts: Encrypted Vault & Recovery Engine
// ---------------------------------------------------------------------------

export interface StorageQuotaReport {
  readonly usageBytes: number;
  readonly quotaBytes: number;
  readonly remainingBytes: number;
  readonly isNearQuotaLimit: boolean;
}

export interface RecoveryBackupBundle {
  readonly vincaRecoveryVersion: "1.0";
  readonly createdAtUtc: string;
  readonly saltHex: string;
  readonly kdfIterations: number;
  readonly encryptedContexts: readonly EncryptedPayload[];
  readonly encryptedReceipts: readonly EncryptedPayload[];
}

export interface RecoveryRestoreResult {
  readonly restoredContextsCount: number;
  readonly restoredReceiptsCount: number;
  readonly staleCoverageWarning: boolean;
}

export interface VincaVaultPort {
  openWorkspace(): Promise<void>;
  clearWorkspace(): Promise<void>;
  saveEncryptedContext(context: ContextSummary, keyPayload?: EncryptedPayload): Promise<void>;
  saveEncryptedReceipt(receipt: Receipt): Promise<void>;
  deleteEncryptedContext(id: string): Promise<void>;
  exportRecoveryBackup(passphrase: string): Promise<RecoveryBackupBundle>;
  importRecoveryBackup(bundle: RecoveryBackupBundle, passphrase: string): Promise<RecoveryRestoreResult>;
  checkQuota(): Promise<StorageQuotaReport>;
}

// ---------------------------------------------------------------------------
// Finalized Phase 7 Service Contracts: Public Blockchain-Data Relay
// ---------------------------------------------------------------------------

export interface RelayHealthReport {
  readonly status: "connected" | "degraded" | "unavailable";
  readonly upstreamConnected: boolean;
  readonly configuredProfiles: readonly Network[];
  readonly latencyMs: number;
}

export interface VincaRelayPort {
  checkHealth(): Promise<RelayHealthReport>;
  getTipHeight(network: Network): Promise<number>;
  fetchCompactBlocks(network: Network, range: CoverageRange): Promise<Uint8Array>;
  fetchTransaction(network: Network, txIdHex: string): Promise<Uint8Array>;
}
