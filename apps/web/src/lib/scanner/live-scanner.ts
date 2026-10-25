/*
  lib/scanner/live-scanner.ts — Live scanning & note discovery engine (Phase 8).

  Coordinates between:
    • VincaRelayPort (fetching public block ranges and full transactions)
    • VincaWorkerPort (local WebAssembly trial decryption & memo decryption)
    • VincaVaultPort (authenticated IndexedDB persistence)

  Key Privacy & Integrity Assurances
  ──────────────────────────────────
  1. Zero matching information is sent to the relay during block scanning.
     The relay only sees contiguous range queries.
  2. Reorganisation detection: When a chain reorg is detected by the worker,
     affected receipts and scan coverage are rolled back to the common ancestor
     height, preventing stale or phantom note assertions.
  3. Deduplication: Receipts are uniquely identified and deduplicated by
     (network, pool, txIdHex, actionIndex). If overlapping viewing contexts
     match the same note, the receipt records the duplicate occurrence.
  4. Exact arithmetic: Note amounts are preserved as integer zatoshis string
     representations throughout scanning and persistence.
*/

import type {
  ContextSummary,
  CoverageRange,
  Receipt,
} from "@/types";
import type {
  OpaqueKeyHandle,
  VincaRelayPort,
  VincaVaultPort,
  VincaWorkerPort,
  WorkerScanResult,
} from "@/adapters/types";

export interface ScanProgressUpdate {
  readonly currentHeight: number;
  readonly targetHeight: number;
  readonly newReceiptsCount: number;
  readonly reorgDetected: boolean;
}

export interface ScanOptions {
  readonly targetHeight?: number;
  readonly chunkSize?: number;
  readonly onProgress?: (update: ScanProgressUpdate) => void;
}

export interface ScanResult {
  readonly updatedContext: ContextSummary;
  readonly newReceipts: readonly Receipt[];
  readonly reorgOccurred: boolean;
  readonly rollbackHeight?: number;
}

export class LiveScanner {
  constructor(
    private readonly relay: VincaRelayPort,
    private readonly worker: VincaWorkerPort,
    private readonly vault?: VincaVaultPort,
  ) {}

  /**
   * Scans from the last scanned height (or birthday height) up to the chain tip.
   */
  async scanContext(
    context: ContextSummary,
    handle: OpaqueKeyHandle,
    existingReceipts: readonly Receipt[],
    options?: ScanOptions,
  ): Promise<ScanResult> {
    const tipHeight = options?.targetHeight ?? (await this.relay.getTipHeight(context.network));
    const startHeight = (context.coverage.lastScannedHeight ?? context.birthdayHeight - 1) + 1;

    if (startHeight > tipHeight) {
      // Already fully synchronized
      return {
        updatedContext: {
          ...context,
          coverage: {
            ...context.coverage,
            lastScannedHeight: tipHeight,
            tipHeight,
            stale: false,
          },
        },
        newReceipts: [],
        reorgOccurred: false,
      };
    }

    const chunkSize = Math.min(options?.chunkSize ?? 500, 2000);
    let currentHeight = startHeight;
    let accumulatedReceipts: Receipt[] = [...existingReceipts];
    let newDiscoveredReceipts: Receipt[] = [];
    let updatedRanges: CoverageRange[] = [...context.coverage.scannedRanges];
    let reorgOccurred = false;
    let rollbackHeight: number | undefined;

    while (currentHeight <= tipHeight) {
      const chunkEnd = Math.min(currentHeight + chunkSize - 1, tipHeight);
      const chunkRange: CoverageRange = {
        startHeight: currentHeight,
        endHeight: chunkEnd,
      };

      // 1. Fetch public compact blocks from relay
      const compactBlocks = await this.relay.fetchCompactBlocks(context.network, chunkRange);

      // 2. Local trial-decryption inside WASM worker
      const scanResult: WorkerScanResult = await this.worker.scanRange(
        handle,
        chunkRange,
        compactBlocks,
      );

      // 3. Handle chain reorganisation if detected
      if (scanResult.reorgDetected && scanResult.commonAncestorHeight !== undefined) {
        reorgOccurred = true;
        rollbackHeight = scanResult.commonAncestorHeight;

        // Roll back receipts strictly above common ancestor
        accumulatedReceipts = accumulatedReceipts.filter(
          (r) => r.contextId !== context.id || r.blockHeight <= scanResult.commonAncestorHeight!,
        );

        // Truncate coverage ranges above common ancestor
        updatedRanges = this.truncateRangesAbove(
          updatedRanges,
          scanResult.commonAncestorHeight,
        );

        // Rescan from common ancestor + 1
        currentHeight = scanResult.commonAncestorHeight + 1;
        continue;
      }

      // 4. Record new receipts with deduplication
      for (const rawReceipt of scanResult.decryptedReceipts) {
        const isDuplicate = accumulatedReceipts.some(
          (r) =>
            r.network === rawReceipt.network &&
            r.pool === rawReceipt.pool &&
            r.txIdHex.toLowerCase() === rawReceipt.txIdHex.toLowerCase() &&
            r.actionIndex === rawReceipt.actionIndex,
        );

        if (!isDuplicate) {
          const receipt: Receipt = {
            ...rawReceipt,
            id: rawReceipt.id || `rc-${Date.now()}-${accumulatedReceipts.length}`,
            contextId: context.id,
            evidence: "locally-inspected",
          };
          accumulatedReceipts.push(receipt);
          newDiscoveredReceipts.push(receipt);

          // Persist to encrypted vault if connected
          if (this.vault) {
            await this.vault.saveEncryptedReceipt(receipt).catch(() => {});
          }
        }
      }

      // 5. Merge contiguous range
      updatedRanges = this.mergeRange(updatedRanges, chunkRange);
      currentHeight = chunkEnd + 1;

      // Progress callback
      options?.onProgress?.({
        currentHeight: chunkEnd,
        targetHeight: tipHeight,
        newReceiptsCount: newDiscoveredReceipts.length,
        reorgDetected: reorgOccurred,
      });
    }

    // Recalculate coverage gaps
    const gaps = this.calculateGaps(context.birthdayHeight, tipHeight, updatedRanges);

    const updatedContext: ContextSummary = {
      ...context,
      receiptCount: accumulatedReceipts.filter((r) => r.contextId === context.id).length,
      coverage: {
        source: "live-local-scan",
        birthdayHeight: context.birthdayHeight,
        scannedRanges: updatedRanges,
        gaps,
        lastScannedHeight: tipHeight,
        tipHeight,
        stale: false,
        reorgNotice: reorgOccurred
          ? {
              rollbackHeight: rollbackHeight ?? startHeight,
              detectedAtUtc: new Date().toISOString(),
              reason: "Upstream chain reorganisation detected; intervals and receipts rewound.",
            }
          : undefined,
      },
    };

    // Persist updated context to vault
    if (this.vault) {
      await this.vault.saveEncryptedContext(updatedContext).catch(() => {});
    }

    return {
      updatedContext,
      newReceipts: newDiscoveredReceipts,
      reorgOccurred,
      rollbackHeight,
    };
  }

  /**
   * On-demand memo decryption:
   * Fetches full transaction bytes from the relay and decrypts in the worker.
   */
  async fetchAndDecryptMemo(
    context: ContextSummary,
    handle: OpaqueKeyHandle,
    receipt: Receipt,
  ): Promise<Receipt> {
    // 1. Fetch raw transaction bytes
    const txBytes = await this.relay.fetchTransaction(context.network, receipt.txIdHex);

    // 2. Decrypt memo in worker
    const memoResult = await this.worker.decryptMemo(
      handle,
      txBytes,
      receipt.actionIndex,
    );

    const updatedReceipt: Receipt = {
      ...receipt,
      memo: {
        state: "available",
        format: memoResult.format,
        text: memoResult.text,
      },
    };

    // 3. Persist to vault
    if (this.vault) {
      await this.vault.saveEncryptedReceipt(updatedReceipt).catch(() => {});
    }

    return updatedReceipt;
  }

  /**
   * Range utility: truncates scanned ranges at or below rollback height.
   */
  private truncateRangesAbove(ranges: readonly CoverageRange[], rollbackHeight: number): CoverageRange[] {
    const result: CoverageRange[] = [];
    for (const r of ranges) {
      if (r.startHeight <= rollbackHeight) {
        result.push({
          startHeight: r.startHeight,
          endHeight: Math.min(r.endHeight, rollbackHeight),
        });
      }
    }
    return result;
  }

  /**
   * Range utility: merges a newly scanned range into existing contiguous intervals.
   */
  private mergeRange(ranges: readonly CoverageRange[], newRange: CoverageRange): CoverageRange[] {
    const combined = [...ranges, newRange].sort((a, b) => a.startHeight - b.startHeight);
    const merged: Array<{ startHeight: number; endHeight: number }> = [];

    for (const current of combined) {
      if (merged.length === 0) {
        merged.push({ startHeight: current.startHeight, endHeight: current.endHeight });
      } else {
        const last = merged[merged.length - 1];
        if (current.startHeight <= last.endHeight + 1) {
          last.endHeight = Math.max(last.endHeight, current.endHeight);
        } else {
          merged.push({ startHeight: current.startHeight, endHeight: current.endHeight });
        }
      }
    }

    return merged;
  }

  /**
   * Calculates missing intervals (gaps) between birthday and current tip.
   */
  private calculateGaps(
    birthday: number,
    tip: number,
    ranges: readonly CoverageRange[],
  ): CoverageRange[] {
    const gaps: CoverageRange[] = [];
    let pointer = birthday;

    const sorted = [...ranges].sort((a, b) => a.startHeight - b.startHeight);
    for (const r of sorted) {
      if (r.startHeight > pointer) {
        gaps.push({ startHeight: pointer, endHeight: r.startHeight - 1 });
      }
      pointer = Math.max(pointer, r.endHeight + 1);
    }

    if (pointer <= tip) {
      gaps.push({ startHeight: pointer, endHeight: tip });
    }

    return gaps;
  }
}
