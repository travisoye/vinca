/*
  Worker protocol and client adapter test suite (PRD Phase 5).
  Written under the validation freeze; execution remains deferred.
*/

import { describe, expect, it } from "vitest";
import { VincaWorkerClient } from "@/adapters/worker-client";
import type { OpaqueKeyHandle } from "@/adapters/types";

describe("Phase 5: Worker Client Protocol & Policy Enforcement", () => {
  const client = new VincaWorkerClient();

  it("fails explicitly when the WebAssembly worker is unavailable", async () => {
    const rawKey = new TextEncoder().encode("uivktest1validkeybytes000000000000000000000000");
    await expect(client.decodeUivk(rawKey, "testnet")).rejects.toThrow(
      /WORKER_UNAVAILABLE/,
    );
    const handle = "vinca-handle-testnet" as OpaqueKeyHandle;
    await expect(
      client.scanRange(handle, { startHeight: 100, endHeight: 100 }, new Uint8Array()),
    ).rejects.toThrow(/WORKER_UNAVAILABLE/);
    await expect(
      client.decryptMemo(handle, new Uint8Array([1, 2, 3]), {
        id: "receipt-test",
        contextId: "context-test",
        network: "testnet",
        pool: "orchard",
        txIdHex: "00".repeat(32),
        actionIndex: 0,
        recipientAddress: null,
        amountZatoshis: "1",
        blockHeight: 100,
        observedUtc: null,
        evidence: "locally-inspected",
        memo: { state: "not-requested" },
      }),
    ).rejects.toThrow(/WORKER_UNAVAILABLE/);
  });

  it("does not simulate handle destruction when no worker exists", async () => {
    await expect(client.destroyHandle("opaque-handle" as OpaqueKeyHandle)).rejects.toThrow(
      /WORKER_UNAVAILABLE/,
    );
  });
});
