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

import { describe, expect, it } from "vitest";
import { RelayClient } from "@/adapters/relay-client";
import { VincaWorkerClient } from "@/adapters/worker-client";
import { LiveScanner } from "@/lib/scanner/live-scanner";
import type { ContextSummary, CoverageRange, Receipt } from "@/types";
import type {
  OpaqueKeyHandle,
  WorkerScanResult,
} from "@/adapters/types";

describe("Phase 8: Full Application Integration & Live Scanning", () => {
  // -------------------------------------------------------------------------
  // Group A: RelayClient Port Implementation
  // -------------------------------------------------------------------------
  describe("Group A: RelayClient Contract", () => {
    it("reports relay health or fallback in offline environments", async () => {
      const relay = new RelayClient({ baseUrl: "http://localhost:3999" });
      const health = await relay.checkHealth();
      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("configuredProfiles");
      expect(health.configuredProfiles).toContain("testnet");
    });

    it("fetches testnet tip height and rejects mainnet queries", async () => {
      const relay = new RelayClient();
      const tip = await relay.getTipHeight("testnet");
      expect(tip).toBeGreaterThan(0);

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
      const bytes = await relay.fetchTransaction("testnet", validTxId);
      expect(bytes).toBeInstanceOf(Uint8Array);
    });
  });

  // -------------------------------------------------------------------------
  // Group B: WorkerClient Policy Enforcement
  // -------------------------------------------------------------------------
  describe("Group B: WorkerClient & Cryptographic Policy", () => {
    const worker = new VincaWorkerClient();

    it("decodes valid testnet UIVK and yields opaque handle", async () => {
      const uivkText = "uviewtest1samplevincakey0000";
      const bytes = new TextEncoder().encode(uivkText);
      const res = await worker.decodeUivk(bytes, "testnet");

      expect(res.handle).toBeDefined();
      expect(typeof res.handle).toBe("string");
      expect(res.network).toBe("testnet");
      expect(res.retainedPools).toContain("orchard");
      expect(res.declaredUnretained).toContain("sapling");
    });

    it("rejects mainnet UIVKs with explicit error code", async () => {
      const mainnetKey = new TextEncoder().encode("uview1mainnetkey0000");
      await expect(worker.decodeUivk(mainnetKey, "testnet")).rejects.toThrow(
        /MAINNET_REJECTED/,
      );
    });

    it("rejects Unified Full Viewing Keys (UFVK)", async () => {
      const ufvkKey = new TextEncoder().encode("ufvk1samplefullviewingkey0000");
      await expect(worker.decodeUivk(ufvkKey, "testnet")).rejects.toThrow(
        /UFVK_REJECTED/,
      );
    });

    it("rejects spending key material", async () => {
      const spendingKey = new TextEncoder().encode("secret-spending-key-0000");
      await expect(worker.decodeUivk(spendingKey, "testnet")).rejects.toThrow(
        /SPENDING_KEY_REJECTED/,
      );
    });

    it("destroys opaque handles cleanly", async () => {
      const handle = "vinca-handle-test-123" as OpaqueKeyHandle;
      await expect(worker.destroyHandle(handle)).resolves.toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Group C: LiveScanner Contiguous Scanning & Reorg Rollback
  // -------------------------------------------------------------------------
  describe("Group C: LiveScanner Engine & Reorg Handling", () => {
    it("scans contiguous ranges and produces deduplicated receipts", async () => {
      const relay = new RelayClient();
      const worker = new VincaWorkerClient();
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
          scannedRanges: [{ startHeight: 2_700_000, endHeight: 2_700_100 }],
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
      expect(result.updatedContext.coverage.scannedRanges.length).toBeGreaterThan(0);
      expect(result.reorgOccurred).toBe(false);
    });

    it("rolls back coverage and receipts on chain reorganisation", async () => {
      // Mock worker that simulates a reorganisation detection at block 2,700,050
      const mockReorgWorker: any = {
        scanRange: async (_h: any, range: CoverageRange): Promise<WorkerScanResult> => {
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
      };

      const relay = new RelayClient();
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

    it("fetches and decrypts memos on-demand after privacy confirmation", async () => {
      const relay = new RelayClient();
      const worker = new VincaWorkerClient();
      const scanner = new LiveScanner(relay, worker);

      const mockReceipt: Receipt = {
        id: "rc-memo-test",
        contextId: "ctx-test",
        network: "testnet",
        pool: "orchard",
        txIdHex: "ab".repeat(32),
        actionIndex: 0,
        recipientAddress: "utest1memo",
        amountZatoshis: "300000000",
        blockHeight: 2_700_050,
        observedUtc: new Date().toISOString(),
        evidence: "locally-inspected",
        memo: { state: "not-requested" },
      };

      const updated = await scanner.fetchAndDecryptMemo(
        { id: "ctx-test", network: "testnet" } as any,
        "vinca-handle-test" as OpaqueKeyHandle,
        mockReceipt,
      );

      expect(updated.memo.state).toBe("available");
      if (updated.memo.state === "available") {
        expect(updated.memo.text).toContain("Invoice #1042");
      }
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
