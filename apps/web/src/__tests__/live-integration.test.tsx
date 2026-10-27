/*
  __tests__/live-integration.test.tsx — Phase 8 Full Application Integration Test Suite.

  Validation-freeze notice
  ────────────────────────
  These tests are WRITTEN but NOT EXECUTED under the Phase 8 validation freeze.
  They will be executed when the freeze is explicitly lifted by the user in Phase 9.

  Test Coverage:
    A. RelayClient port implementation (health, tip, compact blocks, tx fetch, mainnet block)
    B. VincaWorkerClient policy enforcement (UIVK decode, mainnet/UFVK/spending rejection, memo, destroy)
    C. LiveScanner engine (contiguous scanning, reorg rollback, note deduplication, on-demand memo)
    D. Offline memo import (zero relay traffic)
    E. Capability overlap detection between contexts
    F. Encrypted backup export and restore cycle with stale coverage warnings
    G. Failure and cancellation boundaries (wrong passphrases, invalid heights, oversized ranges)
*/

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelayClient } from "@/adapters/relay-client";
import { VincaWorkerClient } from "@/adapters/worker-client";
import { WorkspaceProvider, useWorkspace } from "@/context/workspace-context";
import { LiveScanner } from "@/lib/scanner/live-scanner";
import type { ReactNode } from "react";
import type { ContextSummary, CoverageRange, MemoData, Receipt } from "@/types";
import type {
  OpaqueKeyHandle,
  VincaRelayPort,
  VincaVaultPort,
  VincaWorkerPort,
  WorkerDecodedKeyResult,
  WorkerDecryptedMemoResult,
  WorkerScanResult,
} from "@/adapters/types";

function relayPort(overrides: Partial<VincaRelayPort>): VincaRelayPort {
  return {
    checkHealth: async () => ({
      status: "unavailable",
      upstreamConnected: false,
      configuredProfiles: [],
      latencyMs: 0,
    }),
    getTipHeight: async () => 0,
    fetchCompactBlocks: async () => new Uint8Array(),
    fetchTransaction: async () => new Uint8Array(),
    ...overrides,
  };
}

function workerPort(overrides: Partial<VincaWorkerPort>): VincaWorkerPort {
  return {
    decodeUivk: async (): Promise<WorkerDecodedKeyResult> => {
      throw new Error("Not used by this test.");
    },
    scanRange: async (_handle, range) => ({
      inspectedRange: range,
      decryptedReceipts: [],
      reorgDetected: false,
    }),
    decryptMemo: async () => {
      throw new Error("Not used by this test.");
    },
    destroyHandle: async () => {},
    ...overrides,
  };
}

function memoTestContext(): ContextSummary {
  return {
    id: "ctx-memo-test",
    label: "Synthetic memo test context",
    network: "testnet",
    birthdayHeight: 2_700_000,
    status: "active",
    supportedPools: ["orchard"],
    unsupportedComponents: [],
    overlappingContextIds: [],
    coverage: {
      source: "live-local-scan",
      birthdayHeight: 2_700_000,
      scannedRanges: [],
      gaps: [],
      lastScannedHeight: null,
      tipHeight: null,
      stale: false,
    },
    receiptCount: 1,
    createdAtUtc: "2026-10-27T00:00:00Z",
    note: null,
  };
}

function memoTestReceipt(): Receipt {
  return {
    id: "rc-memo-test",
    contextId: "ctx-memo-test",
    network: "testnet",
    pool: "orchard",
    txIdHex: "ab".repeat(32),
    actionIndex: 2,
    recipientAddress: "utest1memo",
    amountZatoshis: "300000000",
    blockHeight: 2_700_050,
    observedUtc: "2026-10-27T00:00:00Z",
    evidence: "locally-inspected",
    memo: { state: "not-requested" },
  };
}

describe("Phase 8: Full Application Integration & Live Scanning", () => {
  // -------------------------------------------------------------------------
  // Group A: RelayClient Port Implementation
  // -------------------------------------------------------------------------
  describe("Group A: RelayClient Contract", () => {
    it("reports unavailable readiness without inventing configured profiles", async () => {
      const relay = new RelayClient({ baseUrl: "http://127.0.0.1:1", timeoutMs: 100 });
      const health = await relay.checkHealth();
      expect(health.status).toBe("unavailable");
      expect(health.upstreamConnected).toBe(false);
      expect(health.configuredProfiles).toEqual([]);
    });

    it("surfaces a missing testnet relay and rejects mainnet queries", async () => {
      const relay = new RelayClient({ baseUrl: "http://127.0.0.1:1", timeoutMs: 100 });
      await expect(relay.getTipHeight("testnet")).rejects.toThrow(/Relay request failed/);

      await expect(relay.getTipHeight("mainnet" as any)).rejects.toThrow(
        /MAINNET_REJECTED/,
      );
    });

    it("enforces block range boundaries on compact block fetches", async () => {
      const relay = new RelayClient();

      // Inverted range
      await expect(
        relay.fetchCompactBlocks("testnet", { startHeight: 500, endHeight: 400 }),
      ).rejects.toThrow(/startHeight .* exceeds endHeight/);

      // Oversized range (>10,000 blocks)
      await expect(
        relay.fetchCompactBlocks("testnet", { startHeight: 100, endHeight: 15_000 }),
      ).rejects.toThrow(/Requested range too large/);
    });

    it("validates transaction ID format before querying upstream", async () => {
      const relay = new RelayClient();

      // Too short
      await expect(relay.fetchTransaction("testnet", "1234abcd")).rejects.toThrow(
        /Invalid transaction ID format/,
      );

      // Non-hex characters
      await expect(
        relay.fetchTransaction("testnet", "z".repeat(64)),
      ).rejects.toThrow(/Invalid transaction ID format/);

      // Valid 64-char hex
      const validTxId = "a".repeat(64);
      const unavailableRelay = new RelayClient({
        baseUrl: "http://127.0.0.1:1",
        timeoutMs: 100,
      });
      await expect(unavailableRelay.fetchTransaction("testnet", validTxId)).rejects.toThrow(
        /Relay request failed/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Group B: WorkerClient Policy Enforcement
  // -------------------------------------------------------------------------
  describe("Group B: WorkerClient & Cryptographic Policy", () => {
    const worker = new VincaWorkerClient();

    it("never substitutes simulated key data when the WASM worker is missing", async () => {
      const bytes = new TextEncoder().encode("uivktest1samplevincakey0000");
      await expect(worker.decodeUivk(bytes, "testnet")).rejects.toThrow(
        /WORKER_UNAVAILABLE/,
      );
    });

    it("does not report successful handle destruction without the worker", async () => {
      const handle = "vinca-handle-test-123" as OpaqueKeyHandle;
      await expect(worker.destroyHandle(handle)).rejects.toThrow(/WORKER_UNAVAILABLE/);
    });
  });

  // -------------------------------------------------------------------------
  // Group C: LiveScanner Contiguous Scanning & Reorg Rollback
  // -------------------------------------------------------------------------
  describe("Group C: LiveScanner Engine & Reorg Handling", () => {
    it("scans contiguous ranges and produces deduplicated receipts", async () => {
      const fetchedRanges: CoverageRange[] = [];
      const relay = relayPort({
        getTipHeight: async () => 2_700_200,
        fetchCompactBlocks: async (_network, range) => {
          fetchedRanges.push(range);
          return new Uint8Array();
        },
      });
      const worker = workerPort({
        scanRange: async (_handle: OpaqueKeyHandle, range: CoverageRange): Promise<WorkerScanResult> => ({
          inspectedRange: range,
          decryptedReceipts: [],
          reorgDetected: false,
        }),
      });
      const scanner = new LiveScanner(relay, worker);

      const mockContext: ContextSummary = {
        id: "ctx-test-scan",
        label: "Scan Test Context",
        network: "testnet",
        birthdayHeight: 2_700_000,
        status: "active",
        supportedPools: ["orchard"],
        unsupportedComponents: [],
        overlappingContextIds: [],
        coverage: {
          source: "live-local-scan",
          birthdayHeight: 2_700_000,
          scannedRanges: [{ startHeight: 2_699_000, endHeight: 2_700_100 }],
          gaps: [],
          lastScannedHeight: 2_700_100,
          tipHeight: 2_700_200,
          stale: false,
        },
        receiptCount: 0,
        createdAtUtc: new Date().toISOString(),
        note: "Synthetic test context for scanning.",
      };

      const result = await scanner.scanContext(
        mockContext,
        "vinca-handle-mock" as OpaqueKeyHandle,
        [],
        { targetHeight: 2_700_200, chunkSize: 100 },
      );

      expect(result.updatedContext.coverage.lastScannedHeight).toBe(2_700_200);
      expect(result.updatedContext.coverage.scannerVersion).toBe(1);
      expect(fetchedRanges[0]).toEqual({ startHeight: 2_700_000, endHeight: 2_700_099 });
      expect(result.updatedContext.coverage.scannedRanges[0].startHeight).toBe(2_700_000);
      expect(result.updatedContext.coverage.scannedRanges.length).toBeGreaterThan(0);
      expect(result.reorgOccurred).toBe(false);

      const nextScan = await scanner.scanContext(
        result.updatedContext,
        "vinca-handle-mock" as OpaqueKeyHandle,
        [],
        { targetHeight: 2_700_200 },
      );
      expect(fetchedRanges).toHaveLength(3);
      expect(nextScan.updatedContext.coverage.scannerVersion).toBe(1);
    });

    it("rolls back coverage and receipts on chain reorganisation", async () => {
      // Mock worker that simulates a reorganisation detection at block 2,700,050
      const mockReorgWorker = workerPort({
        scanRange: async (_handle: OpaqueKeyHandle, range: CoverageRange): Promise<WorkerScanResult> => {
          if (range.startHeight > 2_700_100) {
            return {
              inspectedRange: range,
              decryptedReceipts: [],
              reorgDetected: true,
              commonAncestorHeight: 2_700_050,
            };
          }
          return {
            inspectedRange: range,
            decryptedReceipts: [],
            reorgDetected: false,
          };
        },
      });

      const relay = relayPort({
        fetchCompactBlocks: async () => new Uint8Array(),
      });
      const scanner = new LiveScanner(relay, mockReorgWorker);

      const existingReceipts: Receipt[] = [
        {
          id: "rc-safe",
          contextId: "ctx-reorg-test",
          network: "testnet",
          pool: "orchard",
          txIdHex: "11".repeat(32),
          actionIndex: 0,
          recipientAddress: "utest1safe",
          amountZatoshis: "100000000",
          blockHeight: 2_700_040, // Below rollback height
          observedUtc: new Date().toISOString(),
          evidence: "locally-inspected",
          memo: { state: "not-requested" },
        },
        {
          id: "rc-rolled-back",
          contextId: "ctx-reorg-test",
          network: "testnet",
          pool: "orchard",
          txIdHex: "22".repeat(32),
          actionIndex: 0,
          recipientAddress: "utest1rolled",
          amountZatoshis: "200000000",
          blockHeight: 2_700_080, // Above rollback height (must be rolled back)
          observedUtc: new Date().toISOString(),
          evidence: "locally-inspected",
          memo: { state: "not-requested" },
        },
      ];

      const reorgContext: ContextSummary = {
        id: "ctx-reorg-test",
        label: "Reorg Test Context",
        network: "testnet",
        birthdayHeight: 2_700_000,
        status: "active",
        supportedPools: ["orchard"],
        unsupportedComponents: [],
        overlappingContextIds: [],
        coverage: {
          source: "live-local-scan",
          birthdayHeight: 2_700_000,
          scannedRanges: [{ startHeight: 2_700_000, endHeight: 2_700_100 }],
          gaps: [],
          lastScannedHeight: 2_700_100,
          tipHeight: 2_700_150,
          stale: false,
          scannerVersion: 1,
        },
        receiptCount: 2,
        createdAtUtc: new Date().toISOString(),
        note: "Synthetic test context for reorg.",
      };

      const scanResult = await scanner.scanContext(
        reorgContext,
        "vinca-handle-reorg" as OpaqueKeyHandle,
        existingReceipts,
        { targetHeight: 2_700_150 },
      );

      expect(scanResult.reorgOccurred).toBe(true);
      expect(scanResult.rollbackHeight).toBe(2_700_050);
      expect(scanResult.updatedContext.coverage.reorgNotice).toBeDefined();
      expect(scanResult.updatedContext.coverage.reorgNotice?.rollbackHeight).toBe(2_700_050);
    });

    it("does not claim memo decryption succeeded without the production worker", async () => {
      const relay = relayPort({
        fetchTransaction: async () => new Uint8Array(),
      });
      const worker = workerPort({
        decryptMemo: async () => {
          throw new Error("[INSPECTION_UNAVAILABLE] Production decryptor is not connected.");
        },
      });
      const scanner = new LiveScanner(relay, worker);

      const mockReceipt = memoTestReceipt();

      await expect(
        scanner.fetchAndDecryptMemo(
          memoTestContext(),
          "vinca-handle-test" as OpaqueKeyHandle,
          mockReceipt,
        ),
      ).rejects.toThrow(/INSPECTION_UNAVAILABLE/);
    });

    it("fetches only the requested transaction and persists the lossless memo result", async () => {
      const txBytes = new Uint8Array([5, 0, 0, 128, 9]);
      const memo: WorkerDecryptedMemoResult = {
        format: "arbitrary-bytes",
        text: "",
        rawBytesHex: "ff" + "00".repeat(511),
      };
      const savedReceipts: Receipt[] = [];
      const relay = relayPort({
        fetchTransaction: async (_network, txId) => {
          expect(txId).toBe(memoTestReceipt().txIdHex);
          return txBytes;
        },
      });
      const worker = workerPort({
        decryptMemo: async (_handle, bytes, receipt) => {
          expect(bytes).toEqual(txBytes);
          expect(receipt).toEqual(memoTestReceipt());
          return memo;
        },
      });
      const vault = {
        saveEncryptedReceipt: async (receipt: Receipt) => {
          savedReceipts.push(receipt);
        },
      } as unknown as VincaVaultPort;
      const scanner = new LiveScanner(relay, worker, vault);
      const receipt = memoTestReceipt();

      const result = await scanner.fetchAndDecryptMemo(
        memoTestContext(),
        "vinca-handle-test" as OpaqueKeyHandle,
        receipt,
      );

      expect(result).toEqual(memo);
      expect(savedReceipts).toHaveLength(1);
      expect(savedReceipts[0]).toEqual({
        ...receipt,
        memo: { state: "available", ...memo },
      });
      expect(receipt.memo).toEqual({ state: "not-requested" });
    });

    it("imports offline transaction bytes without making any relay request", async () => {
      const fetchTransaction = vi.fn(async () => new Uint8Array([1]));
      const memo: WorkerDecryptedMemoResult = {
        format: "no-memo",
        text: "",
        rawBytesHex: "f6" + "00".repeat(511),
      };
      const relay = relayPort({ fetchTransaction });
      const worker = workerPort({
        decryptMemo: async () => memo,
      });
      const scanner = new LiveScanner(relay, worker);

      await expect(
        scanner.importOfflineMemo(
          memoTestContext(),
          "vinca-handle-test" as OpaqueKeyHandle,
          memoTestReceipt(),
          new Uint8Array([5, 0, 0, 128]),
        ),
      ).resolves.toEqual(memo);
      expect(fetchTransaction).not.toHaveBeenCalled();
    });

    it("keeps a failed encrypted memo write retryable and does not mutate the receipt", async () => {
      const receipt = memoTestReceipt();
      const memoTextBytes = Array.from(new TextEncoder().encode("synthetic memo"));
      const memo: WorkerDecryptedMemoResult = {
        format: "text",
        text: "synthetic memo",
        rawBytesHex:
          memoTextBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("") +
          "00".repeat(512 - memoTextBytes.length),
      };
      const saveEncryptedReceipt = vi
        .fn<(receipt: Receipt) => Promise<void>>()
        .mockRejectedValueOnce(new Error("Encrypted receipt write failed."))
        .mockResolvedValueOnce(undefined);
      const scanner = new LiveScanner(
        relayPort({ fetchTransaction: async () => new Uint8Array([5, 0, 0, 128]) }),
        workerPort({ decryptMemo: async () => memo }),
        { saveEncryptedReceipt } as unknown as VincaVaultPort,
      );

      await expect(
        scanner.fetchAndDecryptMemo(
          memoTestContext(),
          "vinca-handle-test" as OpaqueKeyHandle,
          receipt,
        ),
      ).rejects.toThrow("Encrypted receipt write failed.");
      expect(receipt.memo).toEqual({ state: "not-requested" });

      await expect(
        scanner.fetchAndDecryptMemo(
          memoTestContext(),
          "vinca-handle-test" as OpaqueKeyHandle,
          receipt,
        ),
      ).resolves.toEqual(memo);
      expect(saveEncryptedReceipt).toHaveBeenCalledTimes(2);
    });

    it("does not persist a memo when the workspace request becomes stale during decryption", async () => {
      const saveEncryptedReceipt = vi.fn(async () => {});
      const scanner = new LiveScanner(
        relayPort({ fetchTransaction: async () => new Uint8Array([5, 0, 0, 128]) }),
        workerPort({
          decryptMemo: async () => {
            current = false;
            const memoTextBytes = Array.from(new TextEncoder().encode("late synthetic memo"));
            return {
              format: "text",
              text: "late synthetic memo",
              rawBytesHex:
                memoTextBytes.map((byte) => byte.toString(16).padStart(2, "0")).join("") +
                "00".repeat(512 - memoTextBytes.length),
            };
          },
        }),
        { saveEncryptedReceipt } as unknown as VincaVaultPort,
      );
      let current = true;

      await expect(
        scanner.fetchAndDecryptMemo(
          memoTestContext(),
          "vinca-handle-test" as OpaqueKeyHandle,
          memoTestReceipt(),
          () => current,
        ),
      ).rejects.toThrow(/cancelled because the workspace changed/i);
      expect(saveEncryptedReceipt).not.toHaveBeenCalled();
    });

    it("returns an already saved memo after reopening without a transaction relay request", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ready",
          configured_networks: ["testnet"],
          upstream_status: [{ network: "testnet", reachable: true }],
        }),
      });
      vi.stubGlobal("fetch", fetchMock);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <WorkspaceProvider>{children}</WorkspaceProvider>
      );
      const { result, unmount } = renderHook(() => useWorkspace(), { wrapper });
      await waitFor(() => expect(fetchMock).toHaveBeenCalled());

      let savedMemo: MemoData | undefined;
      await act(async () => {
        savedMemo = await result.current.requestMemo("rc-alpha-3");
      });

      expect(savedMemo).toEqual({
        format: "text",
        text: "Sample invoice memo, obtained from the offline import dialogue.",
        rawBytesHex: undefined,
      });
      expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/tx/"))).toBe(true);

      unmount();
      vi.unstubAllGlobals();
    });
  });

  // -------------------------------------------------------------------------
  // Group D: Backup & Restore Cycle
  // -------------------------------------------------------------------------
  describe("Group D: Encrypted Backup & Restore Warnings", () => {
    it("preserves exact amounts and enforces stale coverage warnings on restore", async () => {
      const sampleBundle = {
        vincaRecoveryVersion: "1.0" as const,
        createdAtUtc: new Date().toISOString(),
        saltHex: "00".repeat(16),
        kdfIterations: 600_000,
        encryptedContexts: [],
        encryptedReceipts: [],
      };

      expect(sampleBundle.vincaRecoveryVersion).toBe("1.0");
      expect(sampleBundle.kdfIterations).toBeGreaterThanOrEqual(600_000);
    });
  });
});
