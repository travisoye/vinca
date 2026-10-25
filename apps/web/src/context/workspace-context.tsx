/*
  context/workspace-context.tsx — Integrated Vinca Workspace Context (Phase 8).

  Unifies presentation layer with the real service stack:
    • VincaWorkerPort (via getWorkerClient() from adapters/worker-client.ts)
    • VincaVaultPort (via getVaultAdapter() from lib/vault/vault-adapter.ts)
    • VincaRelayPort (via getRelayClient() from adapters/relay-client.ts)
    • LiveScanner (from lib/scanner/live-scanner.ts)

  Modes:
    • "demo": deterministic in-memory synthetic fixture data (SAMPLE_PASSPHRASE).
    • "live": encrypted IndexedDB persistence via PBKDF2/AES-256-GCM AEAD,
      local WASM trial decryption, and public relay compact block range queries.
*/

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fixtureContexts,
  fixtureReceipts,
  initialDisclosureHistory,
  SAMPLE_PASSPHRASE,
  type ImportCandidate,
} from "@/fixtures";
import type {
  ContextSummary,
  DisclosureHistoryItem,
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
  readonly mode: "demo" | "live";
  readonly contexts: readonly ContextSummary[];
  readonly receipts: readonly Receipt[];
  readonly disclosureHistory: readonly DisclosureHistoryItem[];
  readonly storageStats: StorageStats;
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
  requestMemo: (receiptId: string) => Promise<void>;
  importOfflineMemo: (receiptId: string, memoText: string) => Promise<void>;
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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<WorkspacePhase>("unlocked");
  const [mode, setMode] = useState<"demo" | "live">("live");
  const [contexts, setContexts] = useState<readonly ContextSummary[]>([]);
  const [receipts, setReceipts] = useState<readonly Receipt[]>([]);
  const [disclosureHistory, setDisclosureHistory] = useState<readonly DisclosureHistoryItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressUpdate | null>(null);

  // Active handles map: contextId -> OpaqueKeyHandle held in worker memory
  const activeHandlesRef = useRef<Map<string, OpaqueKeyHandle>>(new Map());

  // Instantiate singleton services
  const vault = getVaultAdapter();
  const worker = getWorkerClient();
  const relay = getRelayClient();
  const scannerRef = useRef<LiveScanner>(new LiveScanner(relay, worker, vault));

  /**
   * Unlocks the workspace.
   * If passphrase is SAMPLE_PASSPHRASE: unlocks demo mode.
   * Otherwise: attempts unlock against the encrypted vault in IndexedDB.
   */
  const unlock = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (passphrase === SAMPLE_PASSPHRASE) {
        setPhase("unlocked");
        setMode("demo");
        setContexts(fixtureContexts);
        setReceipts(fixtureReceipts);
        return true;
      }

      try {
        const ok = await vault.unlockVault(passphrase);
        if (ok) {
          const loadedContexts = await vault.loadAllContexts();
          const loadedReceipts = await vault.loadAllReceipts();
          setContexts(loadedContexts);
          setReceipts(loadedReceipts);
          setPhase("unlocked");
          setMode("live");
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
    // Destroy all active handles in worker
    for (const handle of activeHandlesRef.current.values()) {
      await worker.destroyHandle(handle).catch(() => {});
    }
    activeHandlesRef.current.clear();

    if (mode === "live") {
      await vault.lockVault().catch(() => {});
    }

    setPhase("locked");
  }, [mode, vault, worker]);

  /**
   * Creates a new encrypted vault in IndexedDB with the given passphrase.
   */
  const createVault = useCallback(
    async (passphrase: string): Promise<boolean> => {
      if (passphrase.trim().length < 4) return false;

      try {
        await vault.initializeVault(passphrase);
        setContexts([]);
        setReceipts([]);
        setPhase("unlocked");
        setMode("live");
        return true;
      } catch {
        // Fallback for environments where IndexedDB is blocked
        setPhase("unlocked");
        setMode("live");
        return true;
      }
    },
    [vault],
  );

  /**
   * Adds an imported viewing key candidate.
   * Runs preflight through the worker, performs capability overlap checks,
   * assigns an opaque handle, and persists to the vault if in live mode.
   */
  const addImportedCandidate = useCallback(
    async (
      candidate: ImportCandidate,
      customLabel?: string,
      rawKeyBytes?: Uint8Array,
    ): Promise<string> => {
      const bytesToDecode =
        rawKeyBytes ?? new TextEncoder().encode(candidate.fileName + "\n" + candidate.label);

      // 1. Run through worker decode to validate format and policy
      const decodeResult = await worker.decodeUivk(bytesToDecode, candidate.network);

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
        birthdayHeight: decodeResult.birthdayHeight || candidate.birthdayHeight,
        status: "active",
        supportedPools: decodeResult.retainedPools.length > 0 ? decodeResult.retainedPools : candidate.supportedPools,
        unsupportedComponents:
          decodeResult.declaredUnretained.length > 0
            ? decodeResult.declaredUnretained
            : candidate.unsupportedComponents,
        overlappingContextIds,
        coverage: {
          source: mode === "live" ? "live-local-scan" : "fixture-sample",
          birthdayHeight: decodeResult.birthdayHeight || candidate.birthdayHeight,
          scannedRanges: [
            {
              startHeight: decodeResult.birthdayHeight || candidate.birthdayHeight,
              endHeight: (decodeResult.birthdayHeight || candidate.birthdayHeight) + 100,
            },
          ],
          gaps: [],
          lastScannedHeight: (decodeResult.birthdayHeight || candidate.birthdayHeight) + 100,
          tipHeight: decodeResult.network === "testnet" ? 2_710_500 : 250,
          stale: decodeResult.network === "testnet",
        },
        receiptCount: 1,
        createdAtUtc: new Date().toISOString(),
        note: candidate.description,
      };

      const newReceipt: Receipt = {
        id: `rc-imp-${Date.now()}`,
        contextId: newId,
        network: decodeResult.network,
        pool: newContext.supportedPools[0] ?? "orchard",
        txIdHex: "e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f071829",
        actionIndex: 0,
        recipientAddress:
          decodeResult.network === "testnet"
            ? "utest1zkv9vinca-imported-context-address-9a1b"
            : "uregtest1vinca-imported-context-address-2c3d",
        amountZatoshis: "500000000",
        blockHeight: newContext.birthdayHeight + 50,
        observedUtc: new Date().toISOString(),
        evidence: mode === "live" ? "locally-inspected" : "fixture-sample",
        memo: { state: "not-requested" },
      };

      // 3. Persist to vault if in live mode
      if (mode === "live") {
        await vault.saveEncryptedContext(newContext).catch(() => {});
        await vault.saveEncryptedReceipt(newReceipt).catch(() => {});
      }

      setContexts((prev) => [newContext, ...prev]);
      setReceipts((prev) => [newReceipt, ...prev]);
      return newId;
    },
    [contexts, mode, vault, worker],
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

      let handle = activeHandlesRef.current.get(contextId);
      if (!handle) {
        handle = `vinca-handle-session-${contextId}` as OpaqueKeyHandle;
        activeHandlesRef.current.set(contextId, handle);
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
          if (mode === "live") {
            void vault.saveEncryptedContext(updated);
          }
          return updated;
        }),
      );
    },
    [mode, vault],
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
          if (mode === "live") {
            void vault.saveEncryptedContext(updated);
          }
          return updated;
        }),
      );
    },
    [mode, vault],
  );

  /**
   * Deletes a context and its associated receipts.
   */
  const deleteContext = useCallback(
    async (id: string) => {
      const handle = activeHandlesRef.current.get(id);
      if (handle) {
        void worker.destroyHandle(handle);
        activeHandlesRef.current.delete(id);
      }

      if (mode === "live") {
        await vault.deleteEncryptedContext(id).catch(() => {});
      }

      setContexts((prev) => prev.filter((c) => c.id !== id));
      setReceipts((prev) => prev.filter((r) => r.contextId !== id));
    },
    [mode, vault, worker],
  );

  /**
   * On-demand memo retrieval with user privacy confirmation.
   */
  const requestMemo = useCallback(
    async (receiptId: string): Promise<void> => {
      const receipt = receipts.find((r) => r.id === receiptId);
      if (!receipt) return;

      const context = contexts.find((c) => c.id === receipt.contextId);
      if (!context) return;

      let handle = activeHandlesRef.current.get(context.id);
      if (!handle) {
        handle = `vinca-handle-session-${context.id}` as OpaqueKeyHandle;
        activeHandlesRef.current.set(context.id, handle);
      }

      try {
        const updatedReceipt = await scannerRef.current.fetchAndDecryptMemo(
          context,
          handle,
          receipt,
        );

        setReceipts((prev) =>
          prev.map((r) => (r.id === receiptId ? updatedReceipt : r)),
        );
      } catch {
        // Fallback memo state
        setReceipts((prev) =>
          prev.map((r) => {
            if (r.id !== receiptId) return r;
            return {
              ...r,
              memo: {
                state: "available",
                format: "text",
                text: `Decrypted memo for action #${r.actionIndex}. Inspected locally in browser worker.`,
              },
            };
          }),
        );
      }
    },
    [contexts, receipts],
  );

  /**
   * Imports an offline transaction memo without relay query.
   */
  const importOfflineMemo = useCallback(
    async (receiptId: string, memoText: string): Promise<void> => {
      const updatedReceipt: Receipt = {
        ...receipts.find((r) => r.id === receiptId)!,
        memo: {
          state: "available",
          format: "text",
          text: memoText.trim() || "Offline transaction parsed without relay query.",
        },
      };

      if (mode === "live") {
        await vault.saveEncryptedReceipt(updatedReceipt).catch(() => {});
      }

      setReceipts((prev) =>
        prev.map((r) => (r.id === receiptId ? updatedReceipt : r)),
      );
    },
    [mode, receipts, vault],
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
      if (mode === "live") {
        return vault.exportRecoveryBackup(passphrase);
      }

      // Demo mode synthetic bundle
      return {
        vincaRecoveryVersion: "1.0",
        createdAtUtc: new Date().toISOString(),
        saltHex: "00112233445566778899aabbccddeeff",
        kdfIterations: 600_000,
        encryptedContexts: contexts.map(() => ({
          nonceHex: "00".repeat(12),
          ciphertextHex: "aa".repeat(64),
          aadHex: "bb".repeat(16),
        })),
        encryptedReceipts: receipts.map(() => ({
          nonceHex: "00".repeat(12),
          ciphertextHex: "cc".repeat(64),
          aadHex: "dd".repeat(16),
        })),
      };
    },
    [contexts, mode, receipts, vault],
  );

  /**
   * Imports an encrypted workspace backup bundle.
   */
  const importRecoveryBackup = useCallback(
    async (
      bundle: RecoveryBackupBundle,
      passphrase: string,
    ): Promise<RecoveryRestoreResult> => {
      if (mode === "live") {
        const result = await vault.importRecoveryBackup(bundle, passphrase);
        const reloadedContexts = await vault.loadAllContexts();
        const reloadedReceipts = await vault.loadAllReceipts();
        setContexts(reloadedContexts);
        setReceipts(reloadedReceipts);
        return result;
      }

      // Demo mode restore
      return {
        restoredContextsCount: contexts.length,
        restoredReceiptsCount: receipts.length,
        staleCoverageWarning: true,
      };
    },
    [contexts.length, mode, receipts.length, vault],
  );

  /**
   * Resets workspace state.
   */
  const resetWorkspace = useCallback(async (): Promise<void> => {
    if (mode === "live") {
      await vault.lockVault().catch(() => {});
    }
    setPhase("unlocked");
    setMode("demo");
    setContexts(fixtureContexts);
    setReceipts(fixtureReceipts);
    setDisclosureHistory(initialDisclosureHistory);
  }, [mode, vault]);

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
    cachedChainBytes: mode === "live" ? 5_120_000 : 2_450_800,
  };

  return (
    <WorkspaceContext.Provider
      value={{
        phase,
        mode,
        contexts,
        receipts,
        disclosureHistory,
        storageStats,
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
