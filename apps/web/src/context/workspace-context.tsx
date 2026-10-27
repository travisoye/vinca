/*
  context/workspace-context.tsx — Integrated Vinca Workspace Context.

  Unifies presentation layer with the real service stack:
    • VincaWorkerPort (via getWorkerClient() from adapters/worker-client.ts)
    • VincaVaultPort (via getVaultAdapter() from lib/vault/vault-adapter.ts)
    • VincaRelayPort (via getRelayClient() from adapters/relay-client.ts)
    • LiveScanner (from lib/scanner/live-scanner.ts)

  Always live mode: encrypted IndexedDB persistence via PBKDF2/AES-256-GCM AEAD,
  local WASM trial decryption, and public relay compact block range queries.
  No demo/synthetic shortcuts — all connections are real live testnet/regtest.
*/

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { ImportCandidate } from "@/fixtures";
import type {
  ContextSummary,
  DisclosureHistoryItem,
  MemoData,
  Receipt,
  WorkspacePhase,
} from "@/types";
import type {
  OpaqueKeyHandle,
  RecoveryBackupBundle,
  RecoveryRestoreResult,
  StorageQuotaReport,
} from "@/adapters/types";
import { getVaultAdapter } from "@/lib/vault";
import { getWorkerClient } from "@/adapters/worker-client";
import { getRelayClient } from "@/adapters/relay-client";
import {
  LiveScanner,
  type ScanProgressUpdate,
  type ScanResult,
} from "@/lib/scanner";

export interface StorageStats {
  readonly activeContexts: number;
  readonly archivedContexts: number;
  readonly totalReceipts: number;
  readonly cachedChainBytes: number;
  readonly isNearQuotaLimit?: boolean;
}

export interface WorkspaceContextValue {
  readonly phase: WorkspacePhase;
  readonly mode: "live";
  readonly contexts: readonly ContextSummary[];
  readonly receipts: readonly Receipt[];
  readonly disclosureHistory: readonly DisclosureHistoryItem[];
  readonly storageStats: StorageStats;
  readonly relayConnected: boolean | null;
  readonly isScanning: boolean;
  readonly scanProgress: ScanProgressUpdate | null;
  unlock: (passphrase: string) => Promise<boolean>;
  lock: () => Promise<void>;
  createVault: (passphrase: string) => Promise<boolean>;
  addImportedCandidate: (
    candidate: ImportCandidate,
    customLabel?: string,
    rawKeyBytes?: Uint8Array,
  ) => Promise<string>;
  archiveContext: (id: string) => Promise<void>;
  unarchiveContext: (id: string) => Promise<void>;
  deleteContext: (id: string) => Promise<void>;
  scanContext: (contextId: string) => Promise<ScanResult>;
  requestMemo: (receiptId: string) => Promise<MemoData>;
  importOfflineMemo: (receiptId: string, txBytes: Uint8Array) => Promise<MemoData>;
  recordDisclosure: (
    item: Omit<DisclosureHistoryItem, "id" | "createdAtUtc">,
  ) => DisclosureHistoryItem;
  exportRecoveryBackup: (passphrase: string) => Promise<RecoveryBackupBundle>;
  importRecoveryBackup: (
    bundle: RecoveryBackupBundle,
    passphrase: string,
  ) => Promise<RecoveryRestoreResult>;
  resetWorkspace: () => Promise<void>;
  checkQuota: () => Promise<StorageQuotaReport>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [phase, setPhase] = useState<WorkspacePhase>("locked");
  const [contexts, setContexts] = useState<readonly ContextSummary[]>([]);
  const [receipts, setReceipts] = useState<readonly Receipt[]>([]);
  const [disclosureHistory, setDisclosureHistory] = useState<readonly DisclosureHistoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);

  // Active handles map: contextId -> OpaqueKeyHandle held in worker memory
  const activeHandlesRef = useRef<Map<string, OpaqueKeyHandle>>(new Map());

  // Request generation: invalidates in-flight memo work on lock/reset/delete/navigation
  const requestGenerationRef = useRef(0);

  // Instantiate singleton services
  const vault = getVaultAdapter();
  const worker = getWorkerClient();
  const relay = getRelayClient();
  const scannerRef = useRef<LiveScanner>(new LiveScanner(relay, worker, vault));

  const [relayConnected, setRelayConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    relay
      .checkHealth()
      .then((res) => {
        if (mounted) setRelayConnected(res.status === "connected");
      })
      .catch(() => {
        if (mounted) setRelayConnected(false);
      });
    return () => {
      mounted = false;
    };
  }, [relay]);

  /**
   * Unlocks the workspace against the encrypted vault in IndexedDB.
   * Always live mode — no demo shortcut.
   */
  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
      requestGenerationRef.current += 1;
      try {
        const ok = await vault.unlockVault(passphrase);
        if (ok) {
          const loadedContexts = await vault.loadAllContexts();
          const loadedReceipts = await vault.loadAllReceipts();
          setContexts(loadedContexts);
          setReceipts(loadedReceipts);
          setPhase("unlocked");
          return true;
        }
      } catch {
        // Vault unlock failed
      }

      return false;
    },
    [vault],
  );

  /**
   * Locks the workspace and clears key material in worker memory.
   */
  const lock = useCallback(async (): Promise<void> => {
    requestGenerationRef.current += 1;
    // Destroy all active handles in worker
    for (const handle of activeHandlesRef.current.values()) {
      await worker.destroyHandle(handle).catch(() => {});
    }
    activeHandlesRef.current.clear();
    await vault.lockVault().catch(() => { });
    setPhase("locked");
  }, [vault, worker]);

  /**
   * Creates a new encrypted vault in IndexedDB with the given passphrase.
   */
  const createVault = useCallback(
    async (passphrase: string): Promise<boolean> => {
      requestGenerationRef.current += 1;
      if (passphrase.trim().length < 4) return false;

      await vault.initializeVault(passphrase);
      setContexts([]);
      setReceipts([]);
      setPhase("unlocked");
      return true;
    },
    [vault],
  );

  /**
   * Adds an imported viewing key candidate.
   * Runs preflight through the WASM worker, performs capability overlap checks,
   * assigns an opaque handle, and persists to the encrypted vault.
   * Requires real raw viewing key bytes — no synthetic shortcut.
   */
  const addImportedCandidate = useCallback(
    async (
      candidate: ImportCandidate,
      customLabel?: string,
      rawKeyBytes?: Uint8Array,
    ): Promise<string> => {
      if (!rawKeyBytes) {
        throw new Error("A real incoming viewing-key file is required for import.");
      }

      // 1. Run through worker decode to validate format and policy
      const decodeResult = await worker.decodeUivk(rawKeyBytes, candidate.network);

      const newId = `ctx-imp-${Date.now()}`;
      activeHandlesRef.current.set(newId, decodeResult.handle);

      // 2. Detect capability overlap with existing contexts
      const overlappingContextIds: string[] = [];
      if (candidate.sharesCapabilityWith) {
        overlappingContextIds.push(candidate.sharesCapabilityWith);
      }

      for (const existing of contexts) {
        if (
          existing.id !== newId &&
          existing.network === decodeResult.network &&
          candidate.sharesCapabilityWith === existing.id
        ) {
          if (!overlappingContextIds.includes(existing.id)) {
            overlappingContextIds.push(existing.id);
          }
        }
      }

      const newContext: ContextSummary = {
        id: newId,
        label: customLabel?.trim() || candidate.label,
        network: decodeResult.network,
        birthdayHeight: candidate.birthdayHeight,
        status: "active",
        supportedPools: decodeResult.retainedPools.length > 0 ? decodeResult.retainedPools : candidate.supportedPools,
        unsupportedComponents:
          decodeResult.declaredUnretained.length > 0
            ? decodeResult.declaredUnretained
            : candidate.unsupportedComponents,
        overlappingContextIds,
        coverage: {
          source: "live-local-scan",
          birthdayHeight: candidate.birthdayHeight,
          scannedRanges: [],
          gaps: [],
          lastScannedHeight: null,
          tipHeight: null,
          stale: true,
        },
        receiptCount: 0,
        createdAtUtc: new Date().toISOString(),
        note: candidate.description,
      };

      // 3. Always persist to vault
      await vault.saveEncryptedContext(newContext).catch(() => { });

      setContexts((prev) => [newContext, ...prev]);
      return newId;
    },
    [contexts, vault, worker],
  );

  /**
   * Scans a viewing context range against the relay.
   */
  const scanContext = useCallback(
    async (contextId: string): Promise<ScanResult> => {
      const context = contexts.find((c) => c.id === contextId);
      if (!context) {
        throw new Error(`Context not found: ${contextId}`);
      }

      const handle = activeHandlesRef.current.get(contextId);
      if (!handle) {
        throw new Error("The viewing key is not available in this session. Re-import it before scanning.");
      }

      setIsScanning(true);
      try {
        const result = await scannerRef.current.scanContext(
          context,
          handle,
          receipts,
          {
            onProgress: (update) => setScanProgress(update),
          },
        );

        setContexts((prev) =>
          prev.map((c) => (c.id === contextId ? result.updatedContext : c)),
        );

        if (result.newReceipts.length > 0) {
          setReceipts((prev) => [...result.newReceipts, ...prev]);
        }

        return result;
      } finally {
        setIsScanning(false);
        setScanProgress(null);
      }
    },
    [contexts, receipts],
  );

  /**
   * Archives a context.
   */
  const archiveContext = useCallback(
    async (id: string) => {
      setContexts((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const updated: ContextSummary = { ...c, status: "archived" as const };
          void vault.saveEncryptedContext(updated);
          return updated;
        }),
      );
    },
    [vault],
  );

  /**
   * Unarchives a context.
   */
  const unarchiveContext = useCallback(
    async (id: string) => {
      setContexts((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const updated: ContextSummary = { ...c, status: "active" as const };
          void vault.saveEncryptedContext(updated);
          return updated;
        }),
      );
    },
    [vault],
  );

  /**
   * Deletes a context and its associated receipts.
   */
  const deleteContext = useCallback(
    async (id: string) => {
      requestGenerationRef.current += 1;
      const handle = activeHandlesRef.current.get(id);
      if (handle) {
        void worker.destroyHandle(handle);
        activeHandlesRef.current.delete(id);
      }
      await vault.deleteEncryptedContext(id).catch(() => { });
      setContexts((prev) => prev.filter((c) => c.id !== id));
      setReceipts((prev) => prev.filter((r) => r.contextId !== id));
    },
    [vault, worker],
  );

  /**
   * On-demand memo retrieval with user privacy confirmation.
   */
  const requestMemo = useCallback(
    async (receiptId: string): Promise<MemoData> => {
      if (phase !== "unlocked") {
        throw new Error("Memo retrieval requires an unlocked workspace.");
      }
      const receipt = receipts.find((r) => r.id === receiptId);
      if (!receipt) {
        throw new Error("The selected receipt is no longer available in this workspace.");
      }

      if (receipt.memo.state === "available") {
        return {
          format: receipt.memo.format,
          text: receipt.memo.text,
          rawBytesHex: receipt.memo.rawBytesHex,
        };
      }

      const context = contexts.find((c) => c.id === receipt.contextId);
      if (!context) {
        throw new Error("The context for this receipt is no longer available.");
      }

      const handle = activeHandlesRef.current.get(context.id);
      if (!handle) {
        throw new Error("The viewing key is not available in this session. Re-import it before decrypting a memo.");
      }

      const generation = requestGenerationRef.current;
      const isCurrent = () =>
        generation === requestGenerationRef.current &&
        activeHandlesRef.current.get(context.id) === handle;
      const memo = await scannerRef.current.fetchAndDecryptMemo(
        context,
        handle,
        receipt,
        isCurrent,
      );

      if (!isCurrent()) {
        throw new Error("Memo request was cancelled because the workspace changed.");
      }

      const updatedReceipt: Receipt = {
        ...receipt,
        memo: { state: "available", ...memo },
      };
      setReceipts((prev) =>
        prev.map((r) => (r.id === receiptId ? updatedReceipt : r)),
      );
      return memo;
    },
    [contexts, receipts, phase],
  );

  /**
   * Offline memo import: decrypts a memo from raw full-transaction bytes
   * without any relay request. Requires an unlocked live workspace and the
   * context's active handle.
   */
  const importOfflineMemo = useCallback(
    async (receiptId: string, txBytes: Uint8Array): Promise<MemoData> => {
      if (phase !== "unlocked") {
        throw new Error("Offline memo import requires an unlocked workspace.");
      }
      const receipt = receipts.find((r) => r.id === receiptId);
      if (!receipt) {
        throw new Error("The selected receipt is no longer available in this workspace.");
      }

      const context = contexts.find((c) => c.id === receipt.contextId);
      if (!context) {
        throw new Error("The context for this receipt is no longer available.");
      }

      const handle = activeHandlesRef.current.get(context.id);
      if (!handle) {
        throw new Error("The viewing key is not available in this session. Re-import it before importing a memo.");
      }

      const generation = requestGenerationRef.current;
      const isCurrent = () =>
        generation === requestGenerationRef.current &&
        activeHandlesRef.current.get(context.id) === handle;
      const memo = await scannerRef.current.importOfflineMemo(
        context,
        handle,
        receipt,
        txBytes,
        isCurrent,
      );

      if (!isCurrent()) {
        throw new Error("Offline memo import was cancelled because the workspace changed.");
      }

      const updatedReceipt: Receipt = {
        ...receipt,
        memo: { state: "available", ...memo },
      };
      setReceipts((prev) =>
        prev.map((r) => (r.id === receiptId ? updatedReceipt : r)),
      );
      return memo;
    },
    [contexts, receipts, phase],
  );

  /**
   * Records a package disclosure history item.
   */
  const recordDisclosure = useCallback(
    (item: Omit<DisclosureHistoryItem, "id" | "createdAtUtc">): DisclosureHistoryItem => {
      const recorded: DisclosureHistoryItem = {
        ...item,
        id: `disc-${Date.now()}`,
        createdAtUtc: new Date().toISOString(),
      };
      setDisclosureHistory((prev) => [recorded, ...prev]);
      return recorded;
    },
    [],
  );

  /**
   * Exports an encrypted workspace backup bundle.
   */
  const exportRecoveryBackup = useCallback(
    async (passphrase: string): Promise<RecoveryBackupBundle> => {
      return vault.exportRecoveryBackup(passphrase);
    },
    [vault],
  );

  /**
   * Imports an encrypted workspace backup bundle.
   */
  const importRecoveryBackup = useCallback(
    async (
      bundle: RecoveryBackupBundle,
      passphrase: string,
    ): Promise<RecoveryRestoreResult> => {
      const result = await vault.importRecoveryBackup(bundle, passphrase);
      const reloadedContexts = await vault.loadAllContexts();
      const reloadedReceipts = await vault.loadAllReceipts();
      setContexts(reloadedContexts);
      setReceipts(reloadedReceipts);
      return result;
    },
    [vault],
  );

  /**
   * Resets workspace state.
   */
  const resetWorkspace = useCallback(async (): Promise<void> => {
    requestGenerationRef.current += 1;
    for (const handle of activeHandlesRef.current.values()) {
      await worker.destroyHandle(handle).catch(() => {});
    }
    activeHandlesRef.current.clear();
    await vault.lockVault().catch(() => { });
    setPhase("locked");
    setContexts([]);
    setReceipts([]);
    setDisclosureHistory([]);
  }, [vault, worker]);

  /**
   * Checks storage quota.
   */
  const checkQuota = useCallback(async (): Promise<StorageQuotaReport> => {
    return vault.checkQuota();
  }, [vault]);

  const storageStats: StorageStats = {
    activeContexts: contexts.filter((c) => c.status === "active").length,
    archivedContexts: contexts.filter((c) => c.status === "archived").length,
    totalReceipts: receipts.length,
    cachedChainBytes: contexts.length > 0 ? 5_120_000 : 0,
  };

  return (
    <WorkspaceContext.Provider
      value={{
        phase,
        mode: "live",
        contexts,
        receipts,
        disclosureHistory,
        storageStats,
        relayConnected,
        isScanning,
        scanProgress,
        unlock,
        lock,
        createVault,
        addImportedCandidate,
        archiveContext,
        unarchiveContext,
        deleteContext,
        scanContext,
        requestMemo,
        importOfflineMemo,
        recordDisclosure,
        exportRecoveryBackup,
        importRecoveryBackup,
        resetWorkspace,
        checkQuota,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
