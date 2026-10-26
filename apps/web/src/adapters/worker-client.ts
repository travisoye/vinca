/*
  Client adapter implementing VincaWorkerPort.
  Bridges main-thread React workbench to the WebAssembly worker thread.
*/

import type {
  CoverageRange,
  Network,
} from "@/types";
import type {
  OpaqueKeyHandle,
  VincaWorkerPort,
  WorkerDecodedKeyResult,
  WorkerDecryptedMemoResult,
  WorkerScanResult,
} from "./types";

export class VincaWorkerClient implements VincaWorkerPort {
  private worker: Worker | null = null;
  private requestIdCounter = 1;
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(workerInstance?: Worker) {
    if (workerInstance) {
      this.worker = workerInstance;
      this.worker.addEventListener("message", this.handleMessage.bind(this));
      this.worker.addEventListener("error", this.handleWorkerError.bind(this));
    }
  }

  private handleWorkerError(event: ErrorEvent): void {
    const error = new Error(
      `The WebAssembly inspection worker failed: ${event.message || "unknown worker error"}`,
    );
    for (const pending of this.pendingRequests.values()) {
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private handleMessage(event: MessageEvent): void {
    const { id, success, data, error } = event.data;
    const pending = this.pendingRequests.get(id);
    if (!pending) return;

    this.pendingRequests.delete(id);
    if (success) {
      pending.resolve(data);
    } else {
      pending.reject(new Error(`[${error?.code ?? "ERROR"}] ${error?.message ?? "Worker error"}`));
    }
  }

  private sendRequest<T>(type: string, payload: any): Promise<T> {
    const id = `req-${this.requestIdCounter++}`;

    if (!this.worker) {
      return Promise.reject(
        new Error(
          "[WORKER_UNAVAILABLE] The WebAssembly inspection worker could not be started; no live data was inspected.",
        ),
      );
    }

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      try {
        const worker = this.worker;
        if (!worker) {
          this.pendingRequests.delete(id);
          reject(new Error("[WORKER_UNAVAILABLE] The WebAssembly inspection worker stopped."));
          return;
        }
        worker.postMessage({ id, type, payload });
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  async decodeUivk(rawBytes: Uint8Array, network: Network): Promise<WorkerDecodedKeyResult> {
    return this.sendRequest<WorkerDecodedKeyResult>("decode_uivk", { rawBytes, network });
  }

  async scanRange(handle: OpaqueKeyHandle, range: CoverageRange, compactBlocks: Uint8Array): Promise<WorkerScanResult> {
    return this.sendRequest<WorkerScanResult>("scan_range", { handle, range, compactBlocks });
  }

  async decryptMemo(handle: OpaqueKeyHandle, txBytes: Uint8Array, actionIndex: number): Promise<WorkerDecryptedMemoResult> {
    return this.sendRequest<WorkerDecryptedMemoResult>("decrypt_memo", { handle, txBytes, actionIndex });
  }

  async destroyHandle(handle: OpaqueKeyHandle): Promise<void> {
    return this.sendRequest<void>("destroy_handle", { handle });
  }
}

let _workerInstance: VincaWorkerClient | null = null;

export function getWorkerClient(): VincaWorkerClient {
  if (!_workerInstance) {
    let worker: Worker | undefined;
    if (typeof window !== "undefined" && typeof Worker !== "undefined") {
      try {
        worker = new Worker(new URL("../workers/inspection.worker.ts", import.meta.url), {
          type: "module",
        });
      } catch (error) {
        console.error("Unable to create the Vinca inspection worker.", error);
      }
    }
    _workerInstance = new VincaWorkerClient(worker);
  }
  return _workerInstance;
}
