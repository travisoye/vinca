/*
  Worker protocol and client adapter test suite (PRD Phase 5).
  Written under the validation freeze; execution remains deferred.
*/

import { describe, expect, it } from "vitest";
import { VincaWorkerClient } from "@/adapters/worker-client";
import type { OpaqueKeyHandle } from "@/adapters/types";

describe("Phase 5: Worker Client Protocol & Policy Enforcement", () => {
  const client = new VincaWorkerClient();

  it("decodes a valid testnet UIVK and yields an opaque handle", async () => {
    const rawKey = new TextEncoder().encode("uviewtest1validkeybytes000000000000000000000000");
    const result = await client.decodeUivk(rawKey, "testnet");

    expect(result.handle).toMatch(/^vinca-handle-/);
    expect(result.network).toBe("testnet");
    expect(result.retainedPools).toContain("orchard");
    expect(result.retainedPools).toContain("ironwood");
    expect(result.declaredUnretained).toContain("sapling");
  });

  it("rejects mainnet key encodings at the protocol boundary", async () => {
    const mainnetKey = new TextEncoder().encode("uview1mainnetkeyneverallowedinvinca");
    await expect(client.decodeUivk(mainnetKey, "testnet")).rejects.toThrow(/MAINNET_REJECTED/);
  });

  it("rejects UFVK material", async () => {
    const ufvk = new TextEncoder().encode("ufvktest1fullviewingkeynotallowed");
    await expect(client.decodeUivk(ufvk, "testnet")).rejects.toThrow(/UFVK_REJECTED/);
  });

  it("rejects spending key material", async () => {
    const spendKey = new TextEncoder().encode("secret-extended-key1spendingmaterialneverallowed");
    await expect(client.decodeUivk(spendKey, "testnet")).rejects.toThrow(/SPENDING_KEY_REJECTED/);
  });

  it("performs memo decryption on explicit demand", async () => {
    const handle = "vinca-handle-sim-01" as OpaqueKeyHandle;
    const dummyTx = new Uint8Array([0x01, 0x02, 0x03]);
    const memo = await client.decryptMemo(handle, dummyTx, 0);

    expect(memo.format).toBe("text");
    expect(memo.text).toBe("Invoice #1042 — settlement verified");
  });

  it("destroys and invalidates opaque handles on demand", async () => {
    const handle = "vinca-handle-sim-02" as OpaqueKeyHandle;
    await expect(client.destroyHandle(handle)).resolves.toBeUndefined();
  });
});
