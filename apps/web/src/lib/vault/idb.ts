/*
  vault/idb.ts — Typed IndexedDB wrapper for the Vinca encrypted vault.

  Schema
  ──────
  Database name: "vinca-vault-v1"
  Version: 1

  Object stores
  ─────────────
  "vault-meta"  — singleton row holding the vault salt + KDF parameters.
                  Record never contains plaintext key material.
  "contexts"    — one row per imported context, encrypted.
  "receipts"    — one row per receipt, encrypted.
  "chain-cache" — public (unencrypted) compact block cache. Not a private
                  record. Bounded externally.

  Design choices
  ──────────────
  • All reads/writes to contexts and receipts are encrypted before entering
    the store; raw plaintext is never written directly.
  • Transactional writes use IDBTransaction so the database is never left in
    a partially-written state.
  • Quota failures surface as typed `VaultIdbError` with code "QUOTA_EXCEEDED".
  • Multi-tab detection is handled via the "versionchange" event: when another
    tab upgrades the schema, the connection is closed gracefully so the user
    does not hold a stale open connection that blocks the upgrade.
*/

export type VaultIdbErrorCode =
  | "OPEN_FAILED"
  | "READ_FAILED"
  | "WRITE_FAILED"
  | "DELETE_FAILED"
  | "QUOTA_EXCEEDED"
  | "ABORTED"
  | "SCHEMA_MISMATCH";

export class VaultIdbError extends Error {
  constructor(
    public readonly code: VaultIdbErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "VaultIdbError";
  }
}

// ---------------------------------------------------------------------------
// Schema types
// ---------------------------------------------------------------------------

export interface VaultMetaRecord {
  readonly id: "singleton";
  readonly saltHex: string;
  readonly kdfIterations: number;
  readonly schemaVersion: "1.0";
  readonly createdAtUtc: string;
}

export interface EncryptedContextRecord {
  readonly id: string;
  readonly nonceHex: string;
  readonly ciphertextHex: string;
  readonly aadHex: string;
  readonly revision: number;
  readonly createdAtUtc: string;
}

export interface EncryptedReceiptRecord {
  readonly id: string;
  readonly contextId: string;
  readonly nonceHex: string;
  readonly ciphertextHex: string;
  readonly aadHex: string;
  readonly revision: number;
}

// ---------------------------------------------------------------------------
// Database lifecycle
// ---------------------------------------------------------------------------

const DB_NAME = "vinca-vault-v1";
const DB_VERSION = 1;

let _db: IDBDatabase | null = null;

/**
 * Opens (or re-uses) the vault IndexedDB connection.
 * Creates object stores on first open.
 * Handles versionchange for multi-tab conflict detection.
 */
export async function openVaultDb(): Promise<IDBDatabase> {
  if (_db) return _db;

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains("vault-meta")) {
        db.createObjectStore("vault-meta", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("contexts")) {
        db.createObjectStore("contexts", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("receipts")) {
        const store = db.createObjectStore("receipts", { keyPath: "id" });
        store.createIndex("by-context", "contextId", { unique: false });
      }
      if (!db.objectStoreNames.contains("chain-cache")) {
        db.createObjectStore("chain-cache", { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Detect a schema upgrade from another tab and close gracefully.
      db.onversionchange = () => {
        db.close();
        _db = null;
      };

      _db = db;
      resolve(db);
    };

    request.onerror = (event) => {
      reject(
        new VaultIdbError(
          "OPEN_FAILED",
          `Failed to open vault database: ${(event.target as IDBOpenDBRequest).error?.message}`,
          (event.target as IDBOpenDBRequest).error,
        ),
      );
    };

    // Another tab is blocking the upgrade.
    request.onblocked = () => {
      reject(
        new VaultIdbError(
          "ABORTED",
          "Another browser tab is holding the vault database open. Close all other tabs and retry.",
        ),
      );
    };
  });
}

/** Closes the current database connection (e.g. when locking). */
export function closeVaultDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ---------------------------------------------------------------------------
// Generic IDB helpers
// ---------------------------------------------------------------------------

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function wrapQuota<T>(p: Promise<T>): Promise<T> {
  return p.catch((err) => {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new VaultIdbError(
        "QUOTA_EXCEEDED",
        "Browser storage quota exceeded. Export a recovery backup then clear old cached data.",
        err,
      );
    }
    if (err instanceof VaultIdbError) throw err;
    throw new VaultIdbError("WRITE_FAILED", `IDB write failed: ${String(err)}`, err);
  });
}

// ---------------------------------------------------------------------------
// Vault meta
// ---------------------------------------------------------------------------

export async function readVaultMeta(): Promise<VaultMetaRecord | undefined> {
  const db = await openVaultDb();
  const tx = db.transaction("vault-meta", "readonly");
  const store = tx.objectStore("vault-meta");
  return idbRequest<VaultMetaRecord | undefined>(
    store.get("singleton") as IDBRequest<VaultMetaRecord | undefined>,
  );
}

export async function writeVaultMeta(meta: VaultMetaRecord): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction("vault-meta", "readwrite");
  const store = tx.objectStore("vault-meta");
  await wrapQuota(idbRequest(store.put(meta)));
}

// ---------------------------------------------------------------------------
// Encrypted contexts
// ---------------------------------------------------------------------------

export async function putEncryptedContext(record: EncryptedContextRecord): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction("contexts", "readwrite");
  const store = tx.objectStore("contexts");
  await wrapQuota(idbRequest(store.put(record)));
}

export async function getEncryptedContext(id: string): Promise<EncryptedContextRecord | undefined> {
  const db = await openVaultDb();
  const tx = db.transaction("contexts", "readonly");
  const store = tx.objectStore("contexts");
  return idbRequest<EncryptedContextRecord | undefined>(
    store.get(id) as IDBRequest<EncryptedContextRecord | undefined>,
  );
}

export async function getAllEncryptedContexts(): Promise<EncryptedContextRecord[]> {
  const db = await openVaultDb();
  const tx = db.transaction("contexts", "readonly");
  const store = tx.objectStore("contexts");
  return idbRequest<EncryptedContextRecord[]>(
    store.getAll() as IDBRequest<EncryptedContextRecord[]>,
  );
}

export async function deleteEncryptedContext(id: string): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction("contexts", "readwrite");
  const store = tx.objectStore("contexts");
  return idbRequest(store.delete(id)).catch((err) => {
    throw new VaultIdbError("DELETE_FAILED", `Failed to delete context ${id}: ${String(err)}`, err);
  });
}

// ---------------------------------------------------------------------------
// Encrypted receipts
// ---------------------------------------------------------------------------

export async function putEncryptedReceipt(record: EncryptedReceiptRecord): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction("receipts", "readwrite");
  const store = tx.objectStore("receipts");
  await wrapQuota(idbRequest(store.put(record)));
}

export async function getEncryptedReceiptsForContext(
  contextId: string,
): Promise<EncryptedReceiptRecord[]> {
  const db = await openVaultDb();
  const tx = db.transaction("receipts", "readonly");
  const store = tx.objectStore("receipts");
  const index = store.index("by-context");
  return idbRequest<EncryptedReceiptRecord[]>(
    index.getAll(contextId) as IDBRequest<EncryptedReceiptRecord[]>,
  );
}

export async function getAllEncryptedReceipts(): Promise<EncryptedReceiptRecord[]> {
  const db = await openVaultDb();
  const tx = db.transaction("receipts", "readonly");
  const store = tx.objectStore("receipts");
  return idbRequest<EncryptedReceiptRecord[]>(
    store.getAll() as IDBRequest<EncryptedReceiptRecord[]>,
  );
}

export async function deleteEncryptedReceiptsForContext(contextId: string): Promise<void> {
  const db = await openVaultDb();
  const tx = db.transaction("receipts", "readwrite");
  const store = tx.objectStore("receipts");
  const index = store.index("by-context");
  const receipts = await idbRequest<EncryptedReceiptRecord[]>(
    index.getAll(contextId) as IDBRequest<EncryptedReceiptRecord[]>,
  );
  for (const r of receipts) {
    await idbRequest(store.delete(r.id)).catch((err) => {
      throw new VaultIdbError(
        "DELETE_FAILED",
        `Failed to delete receipt ${r.id}: ${String(err)}`,
        err,
      );
    });
  }
}

// ---------------------------------------------------------------------------
// Storage quota
// ---------------------------------------------------------------------------

export async function estimateStorageUsage(): Promise<{
  usageBytes: number;
  quotaBytes: number;
}> {
  if (navigator.storage?.estimate) {
    const estimate = await navigator.storage.estimate();
    return {
      usageBytes: estimate.usage ?? 0,
      quotaBytes: estimate.quota ?? 0,
    };
  }
  // Fallback when Storage API is unavailable (e.g. older browsers).
  return { usageBytes: 0, quotaBytes: 0 };
}
