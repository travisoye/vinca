/*
  vault/disclosure-files.ts — Authenticated file kinds and disclosure engine.

  Authenticated file kinds (PRD §6)
  ──────────────────────────────────
  Vinca produces three mutually exclusive encrypted file kinds:

    "context-access-package"
      Contains an encrypted viewing key. The holder can decrypt further
      matching incoming payments. Continuing access is irrevocable once the
      file is shared.

    "record-snapshot"
      Contains only selected records (receipts + optional memos). NO viewing
      or spending key material is included. Amounts and memos are
      exporter-provided assertions; recipients must not treat them as
      independently verified payment proof.

    "workspace-backup"
      An encrypted bundle of all local contexts and receipts for recovery.
      Does not grant live inspection capability on its own; coverage is stale
      after restore and must be re-validated.

  File-kind substitution prevention
  ───────────────────────────────────
  The `vincaFileKind` field is included in the AAD of every top-level AEAD
  envelope.  Substituting a `record-snapshot` file for a
  `context-access-package` (or vice-versa) causes the AEAD authentication tag
  to fail because the AAD no longer matches the stored envelope.

  Evidence label policy (PRD §6)
  ──────────────────────────────
  Recipient evidence labels are assigned locally. A package's own `verified`
  flag cannot elevate its private records to independent payment proof.
  The `assignLocalEvidenceLabel` function enforces this rule.

  Continuing-access preview (PRD §6)
  ────────────────────────────────────
  Before a context-access package is exported, `buildContinuingAccessPreview`
  computes matching earlier and later receipts to show the full capability scope.
  This is a presentation-only computation; it does not modify any stored state.
*/

import type { ContextSummary, DisclosureKind, EvidenceLevel, Receipt } from "@/types";
import type { CiphertextEnvelope } from "./crypto";

// ---------------------------------------------------------------------------
// Authenticated file kinds
// ---------------------------------------------------------------------------

export type VincaFileKind =
  | "context-access-package"
  | "record-snapshot"
  | "workspace-backup";

/** Schema version for all Vinca-produced files. */
export const FILE_SCHEMA_VERSION = "1.0" as const;

// ---------------------------------------------------------------------------
// On-disk file structure
// ---------------------------------------------------------------------------

/**
 * Top-level envelope for a context-access package.
 *
 * The `vincaFileKind` is inside the AAD so that substituting a different
 * file kind causes AEAD authentication to fail.
 */
export interface ContextAccessPackageFile {
  readonly vincaFileKind: "context-access-package";
  readonly vincaSchemaVersion: typeof FILE_SCHEMA_VERSION;
  readonly contextId: string;
  readonly saltHex: string;
  readonly kdfIterations: number;
  /** Encrypted ContextAccessPayload */
  readonly envelope: CiphertextEnvelope;
  readonly createdAtUtc: string;
}

export interface ContextAccessPayload {
  readonly contextSummary: ContextSummary;
  /** Raw key handle bytes — opaque; only meaningful when integrated with WASM worker. */
  readonly encryptedKeyMaterial: CiphertextEnvelope;
  readonly retainedPoolCodes: readonly string[];
}

/**
 * Top-level envelope for a record snapshot.
 *
 * No viewing or spending key material is included.
 */
export interface RecordSnapshotFile {
  readonly vincaFileKind: "record-snapshot";
  readonly vincaSchemaVersion: typeof FILE_SCHEMA_VERSION;
  readonly contextId: string;
  readonly saltHex: string;
  readonly kdfIterations: number;
  /** Encrypted RecordSnapshotPayload */
  readonly envelope: CiphertextEnvelope;
  readonly createdAtUtc: string;
}

export interface RecordSnapshotPayload {
  readonly contextSummary: ContextSummary;
  /** Only selected receipts; NO key material. */
  readonly selectedReceipts: readonly Receipt[];
  /** True if memo fields are included in the exported records. */
  readonly memosIncluded: boolean;
  /**
   * Exporter-assigned assertion flag.
   * This is a claim by the exporter; recipients must not treat it as
   * independent cryptographic payment proof.
   */
  readonly exporterAssertedVerified: boolean;
}

/**
 * Top-level envelope for a workspace recovery backup.
 */
export interface WorkspaceBackupFile {
  readonly vincaFileKind: "workspace-backup";
  readonly vincaSchemaVersion: typeof FILE_SCHEMA_VERSION;
  readonly saltHex: string;
  readonly kdfIterations: number;
  /** Encrypted WorkspaceBackupPayload */
  readonly envelope: CiphertextEnvelope;
  readonly createdAtUtc: string;
}

export interface WorkspaceBackupPayload {
  readonly contexts: readonly ContextSummary[];
  /**
   * Receipts are included for recovery. Coverage is always stale after a
   * restore — the user must re-validate by re-scanning or confirming sources.
   */
  readonly receipts: readonly Receipt[];
  /** Persisted disclosure history for continuity across restores. */
  readonly disclosureHistorySummaries: readonly WorkspaceBackupDisclosureSummary[];
}

export interface WorkspaceBackupDisclosureSummary {
  readonly id: string;
  readonly createdAtUtc: string;
  readonly kind: DisclosureKind;
  readonly contextId: string;
  readonly contextLabel: string;
  readonly recordCount: number;
}

// ---------------------------------------------------------------------------
// File-kind type guard helpers
// ---------------------------------------------------------------------------

export function isContextAccessPackageFile(
  file: unknown,
): file is ContextAccessPackageFile {
  return (
    typeof file === "object" &&
    file !== null &&
    (file as Record<string, unknown>)["vincaFileKind"] === "context-access-package" &&
    (file as Record<string, unknown>)["vincaSchemaVersion"] === FILE_SCHEMA_VERSION
  );
}

export function isRecordSnapshotFile(file: unknown): file is RecordSnapshotFile {
  return (
    typeof file === "object" &&
    file !== null &&
    (file as Record<string, unknown>)["vincaFileKind"] === "record-snapshot" &&
    (file as Record<string, unknown>)["vincaSchemaVersion"] === FILE_SCHEMA_VERSION
  );
}

export function isWorkspaceBackupFile(file: unknown): file is WorkspaceBackupFile {
  return (
    typeof file === "object" &&
    file !== null &&
    (file as Record<string, unknown>)["vincaFileKind"] === "workspace-backup" &&
    (file as Record<string, unknown>)["vincaSchemaVersion"] === FILE_SCHEMA_VERSION
  );
}

// ---------------------------------------------------------------------------
// Evidence label policy
// ---------------------------------------------------------------------------

/**
 * Assigns a local evidence label when a recipient imports a disclosure file.
 *
 * PRD §6: A package's own `exporterAssertedVerified` flag cannot elevate its
 * private records to independent payment proof. The recipient's label is always
 * "exported-assertion" for record snapshots, regardless of any flag in the file.
 *
 * For locally inspected records the caller must use "locally-inspected".
 */
export function assignLocalEvidenceLabel(
  fileKind: VincaFileKind,
  _exporterAssertedVerified: boolean,
): EvidenceLevel {
  switch (fileKind) {
    case "record-snapshot":
      // Always exporter-provided. Ignore the file's own flag.
      return "exported-assertion";
    case "context-access-package":
      // Key-based import; local inspection will assign "locally-inspected" later.
      return "exported-assertion";
    case "workspace-backup":
      // Restored records retain their original evidence level from the source.
      // The caller reads the evidence field from each stored receipt.
      return "exported-assertion";
  }
}

// ---------------------------------------------------------------------------
// Continuing-access preview builder (presentation only)
// ---------------------------------------------------------------------------

export interface ContinuingAccessPreview {
  readonly contextId: string;
  readonly contextLabel: string;
  readonly retainedPools: readonly string[];
  /** Receipts already decrypted and visible in this workspace. */
  readonly existingMatchedReceipts: readonly Receipt[];
  /**
   * Informational summary: the exported key grants access to future incoming
   * payments not yet scanned, including in coverage gaps.
   */
  readonly futureCoverageWarning: string;
  /** Hardcoded irrevocability notice. */
  readonly irrevocabilityNotice: string;
}

/**
 * Builds the continuing-access preview shown to the exporter before a
 * context-access package is created.
 *
 * This is a presentation-only computation derived from in-memory state.
 * It does NOT modify any stored state.
 */
export function buildContinuingAccessPreview(
  context: ContextSummary,
  receipts: readonly Receipt[],
): ContinuingAccessPreview {
  const matchedReceipts = receipts.filter((r) => r.contextId === context.id);

  return {
    contextId: context.id,
    contextLabel: context.label,
    retainedPools: context.supportedPools,
    existingMatchedReceipts: matchedReceipts,
    futureCoverageWarning:
      "The exported key grants the holder access to all incoming payments " +
      "matching this capability, including payments received after the export " +
      "date and any payments in coverage gaps not yet inspected.",
    irrevocabilityNotice:
      "Archiving this context, deleting the export file, or changing your " +
      "passphrase cannot revoke a key someone already holds.",
  };
}

// ---------------------------------------------------------------------------
// Record-snapshot exclusion validation
// ---------------------------------------------------------------------------

/**
 * Validates that a record snapshot payload does not include any key material.
 * This is a belt-and-suspenders check called before serialisation.
 *
 * Throws if the payload contains fields that suggest key or spending material.
 */
export function assertNoKeyMaterialInSnapshot(payload: RecordSnapshotPayload): void {
  // The type system enforces this at compile time, but we also check at
  // runtime to catch any future serialisation bugs.
  const p = payload as unknown as Record<string, unknown>;
  const forbidden = ["encryptedKeyMaterial", "rawKeyBytes", "ivk", "ovk", "fvk", "sk"];
  for (const field of forbidden) {
    if (field in p) {
      throw new Error(
        `Record snapshot payload must not contain '${field}'. ` +
          "No viewing, spending or note-opening secrets may be included in a snapshot.",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Stale coverage warning
// ---------------------------------------------------------------------------

/**
 * Returns the stale coverage warning string to show after a workspace restore.
 * Coverage is always stale until the user re-scans.
 */
export function buildStaleCoverageWarning(restoredContextCount: number): string {
  return (
    `Restored ${restoredContextCount} context${restoredContextCount === 1 ? "" : "s"} from backup. ` +
    "Coverage is stale: the restored scan heights reflect the time of the backup, not the " +
    "current chain tip. Refresh each context to re-validate coverage and discover any " +
    "payments received since the backup was created."
  );
}

// ---------------------------------------------------------------------------
// Late-payment / retained-copy warnings
// ---------------------------------------------------------------------------

/**
 * Returns the warning message shown before archiving or deleting a context
 * that was previously exported as a context-access package.
 */
export const RETAINED_COPY_WARNING =
  "Anyone who received a context-access package for this key still holds " +
  "a copy of the viewing capability. Archiving or deleting the context in " +
  "Vinca does not revoke their access or prevent them from inspecting future " +
  "incoming payments matching this key.";

/**
 * Returns the late-payment warning shown when the user deletes a context
 * with a coverage gap or a stale scan tip.
 */
export function buildLatePaymentWarning(context: ContextSummary): string {
  const gapCount = context.coverage.gaps.length;
  const stale = context.coverage.stale;

  if (gapCount > 0 && stale) {
    return (
      `This context has ${gapCount} uninspected coverage gap${gapCount === 1 ? "" : "s"} ` +
      "and a stale scan tip. Incoming payments in these periods may not be visible here. " +
      "Deleting the context removes all locally recorded receipts."
    );
  }
  if (gapCount > 0) {
    return (
      `This context has ${gapCount} uninspected coverage gap${gapCount === 1 ? "" : "s"}. ` +
      "Incoming payments during these periods may not be visible here. " +
      "Deleting the context removes all locally recorded receipts."
    );
  }
  if (stale) {
    return (
      "This context has a stale scan tip. Payments received after the last scan " +
      "height may not be visible here. " +
      "Deleting the context removes all locally recorded receipts."
    );
  }
  return "Deleting this context permanently removes all locally recorded receipts.";
}
