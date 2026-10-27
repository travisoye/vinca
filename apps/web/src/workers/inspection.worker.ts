/*
  Vinca WebAssembly inspection worker.
  Private key material is decoded and retained only in WASM worker memory.
*/

import init, {
  dispatch_worker_message,
  decrypt_transaction_memo,
  scan_compact_blocks,
} from "../wasm/vinca_wasm";
import type {
  CoverageRange,
  Network,
  Receipt,
} from "@/types";

export interface WorkerInMessage {
  readonly id: string;
  readonly type: "decode_uivk" | "scan_range" | "decrypt_memo" | "destroy_handle";
  readonly payload: unknown;
}

export interface WorkerOutMessage {
  readonly id: string;
  readonly success: boolean;
  readonly data?: unknown;
  readonly error?: {
    readonly code: string;
    readonly message: string;
  };
}

interface RustResponse<T> {
  readonly status: "ok" | "error";
  readonly data?: T;
  readonly code?: string;
  readonly message?: string;
}

interface ScannedReceipt {
  readonly tx_id_hex: string;
  readonly action_index: number;
  readonly block_height: number;
  readonly block_time: number;
  readonly amount_zatoshis: Receipt["amountZatoshis"];
  readonly pool: "orchard" | "ironwood";
}

const activeHandles = new Map<string, Network>();
let wasmReady: Promise<unknown> | undefined;

function initializeWasm(): Promise<unknown> {
  wasmReady ??= init();
  return wasmReady;
}

function unwrapRustResponse<T>(json: string): T {
  const response = JSON.parse(json) as RustResponse<T>;
  if (response.status === "error") {
    throw {
      code: response.code ?? "INTERNAL_PROTOCOL_ERROR",
      message: response.message ?? "The WASM protocol operation failed.",
    };
  }
  if (response.status !== "ok" || response.data === undefined) {
    throw {
      code: "INVALID_WASM_RESPONSE",
      message: "The WASM protocol operation returned an invalid response.",
    };
  }
  return response.data;
}

function makeReceipt(receipt: ScannedReceipt, network: Network): Receipt {
  return {
    id: `rc-${receipt.tx_id_hex}-${receipt.action_index}`,
    contextId: "",
    network,
    pool: receipt.pool,
    txIdHex: receipt.tx_id_hex,
    actionIndex: receipt.action_index,
    recipientAddress: null,
    amountZatoshis: receipt.amount_zatoshis,
    blockHeight: receipt.block_height,
    observedUtc: new Date(receipt.block_time * 1000).toISOString(),
    evidence: "locally-inspected",
    memo: { state: "not-requested" },
  };
}

self.addEventListener("message", async (event: MessageEvent<WorkerInMessage>) => {
  const { id, type, payload } = event.data;

  try {
    await initializeWasm();

    switch (type) {
      case "decode_uivk": {
        const { rawBytes, network } = payload as {
          rawBytes: Uint8Array;
          network: Network;
        };
        const text = new TextDecoder("utf-8", { fatal: true }).decode(rawBytes).trim();
        const decoded = unwrapRustResponse<{
          handle: string;
          network: Network;
          retained_pools: Receipt["pool"][];
          declared_unretained: string[];
        }>(
          dispatch_worker_message(
            JSON.stringify({
              action: "decode_key",
              payload: {
                raw_key: text,
                network,
                label: "Imported context",
              },
            }),
          ),
        );
        activeHandles.set(decoded.handle, decoded.network);
        const data = {
          handle: decoded.handle,
          network: decoded.network,
          retainedPools: decoded.retained_pools,
          declaredUnretained: decoded.declared_unretained,
        };
        self.postMessage({ id, success: true, data } satisfies WorkerOutMessage);
        break;
      }

      case "scan_range": {
        const { handle, range, compactBlocks } = payload as {
          handle: string;
          range: CoverageRange;
          compactBlocks: Uint8Array;
        };
        const network = activeHandles.get(handle);
        if (!network) {
          throw {
            code: "HANDLE_NOT_FOUND",
            message: "The viewing key is not available in this worker session. Re-import the key to scan.",
          };
        }
        const scanned = unwrapRustResponse<ScannedReceipt[]>(
          scan_compact_blocks(
            handle,
            range.startHeight,
            range.endHeight,
            compactBlocks,
          ),
        );
        const data = {
          inspectedRange: range,
          decryptedReceipts: scanned.map((receipt) => makeReceipt(receipt, network)),
          reorgDetected: false,
        };
        self.postMessage({ id, success: true, data } satisfies WorkerOutMessage);
        break;
      }

      case "decrypt_memo": {
        const { handle, txBytes, receipt } = payload as {
          handle: string;
          txBytes: Uint8Array;
          receipt: Receipt;
        };
        const network = activeHandles.get(handle);
        if (!network) {
          throw {
            code: "HANDLE_NOT_FOUND",
            message: "The viewing key is not available in this worker session. Re-import the key to inspect.",
          };
        }
        if (
          !(txBytes instanceof Uint8Array) ||
          txBytes.length === 0 ||
          txBytes.length > 2 * 1024 * 1024 ||
          !Number.isSafeInteger(receipt.actionIndex) ||
          receipt.actionIndex < 0 ||
          receipt.actionIndex > 0xffff_ffff ||
          !Number.isSafeInteger(receipt.blockHeight) ||
          receipt.blockHeight < 0 ||
          receipt.blockHeight > 0xffff_ffff ||
          !/^[0-9a-f]{64}$/i.test(receipt.txIdHex) ||
          !/^(0|[1-9]\d*)$/.test(receipt.amountZatoshis) ||
          BigInt(receipt.amountZatoshis) > 2_100_000_000_000_000n
        ) {
          throw {
            code: "INVALID_MEMO_REQUEST",
            message: "The selected receipt metadata is invalid.",
          };
        }
        if (receipt.network !== network) {
          throw {
            code: "NETWORK_MISMATCH",
            message: "The selected receipt does not belong to this viewing-key network.",
          };
        }
        const data = unwrapRustResponse<{
          format:
            | "text"
            | "no-memo"
            | "arbitrary-bytes"
            | "future-format"
            | "legacy-nontext";
          text: string;
          rawBytesHex: string;
        }>(
          decrypt_transaction_memo(
            handle,
            txBytes,
            receipt.txIdHex,
            receipt.blockHeight,
            receipt.network,
            receipt.pool,
            receipt.actionIndex,
            receipt.amountZatoshis,
          ),
        );
        self.postMessage({ id, success: true, data } satisfies WorkerOutMessage);
        break;
      }

      case "destroy_handle": {
        const { handle } = payload as { handle: string };
        unwrapRustResponse<boolean>(
          dispatch_worker_message(
            JSON.stringify({
              action: "revoke_handle",
              payload: { handle },
            }),
          ),
        );
        activeHandles.delete(handle);
        self.postMessage({ id, success: true } satisfies WorkerOutMessage);
        break;
      }

      default:
        throw {
          code: "UNKNOWN_TYPE",
          message: `Unknown worker request type: ${type}`,
        };
    }
  } catch (error) {
    const err = error as { code?: string; message?: string };
    const response: WorkerOutMessage = {
      id,
      success: false,
      error: {
        code: err.code ?? "INTERNAL_ERROR",
        message: err.message ?? String(error),
      },
    };
    self.postMessage(response);
  }
});
