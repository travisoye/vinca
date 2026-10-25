/*
  Fixtures/adapters contract tests for phase 1. Written under the validation
  freeze and NOT executed (prd.md validation policy).
*/
import { describe, expect, it } from "vitest";
import { createFixturePorts } from "@/adapters/fixtures";
import { SAMPLE_PASSPHRASE } from "@/fixtures";
import { formatZecFromZatoshis } from "@/lib/format";

const ports = createFixturePorts();

describe("fixture workspace adapter", () => {
  it("starts with no vault and rejects an incorrect passphrase", async () => {
    expect(await ports.workspace.phase()).toBe("no-vault");
    expect(await ports.workspace.unlock("wrong")).toBe("wrong-passphrase");
  });

  it("unlocks only with the publicly documented sample passphrase", async () => {
    expect(await ports.workspace.unlock(SAMPLE_PASSPHRASE)).toBe("unlocked");
    await ports.workspace.lock();
    expect(await ports.workspace.phase()).toBe("locked");
  });
});

describe("fixture context adapter", () => {
  it("lists the fixture contexts and resolves detail by id", async () => {
    const contexts = await ports.contexts.listContexts();
    expect(contexts.length).toBeGreaterThan(0);
    expect(contexts.every((c) => c.network === "testnet" || c.network === "regtest")).toBe(true);
    expect(await ports.contexts.getContext(contexts[0].id)).not.toBeNull();
    expect(await ports.contexts.getContext("__missing__")).toBeNull();
  });

  it("scopes receipts to their context and keeps duplicate-context txids identifiable", async () => {
    const alpha = await ports.contexts.listReceipts("ctx-alpha");
    const duplicate = await ports.contexts.listReceipts("ctx-duplicate");
    expect(alpha.length).toBeGreaterThan(0);
    expect(duplicate.length).toBeGreaterThan(0);
    // The duplicate import shares the same underlying note ids; the
    // comparison screen surfaces them in phase 3.
    expect(alpha.some((r) => duplicate.some((d) => d.txIdHex === r.txIdHex))).toBe(true);
  });
});

describe("fixture disclosure adapter", () => {
  it("contrast continuing-access warnings with snapshot warnings", async () => {
    const contextAccess = await ports.disclosures.preview({
      kind: "context-access-package",
      contextId: "ctx-alpha",
      selectedReceiptIds: [],
      includeMemos: false,
    });
    expect(contextAccess.includesViewingKey).toBe(true);
    expect(contextAccess.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["continuing-access", "irrevocable-holder-copy"]),
    );

    const snapshot = await ports.disclosures.preview({
      kind: "record-snapshot",
      contextId: "ctx-alpha",
      selectedReceiptIds: ["rc-alpha-3", "rc-alpha-4"],
      includeMemos: true,
    });
    expect(snapshot.includesViewingKey).toBe(false);
    expect(snapshot.warnings.map((w) => w.code)).toContain("private-amount-not-proof");
  });

  it("rejects previews for unknown contexts", async () => {
    await expect(
      ports.disclosures.preview({
        kind: "record-snapshot",
        contextId: "__missing__",
        selectedReceiptIds: [],
        includeMemos: false,
      }),
    ).rejects.toThrow("__missing__");
  });
});

describe("exact money formatting", () => {
  it("formats zatoshis into exact decimal strings without float arithmetic", () => {
    expect(formatZecFromZatoshis("123456789")).toBe("1.23456789");
    expect(formatZecFromZatoshis("2500000000")).toBe("25");
    expect(formatZecFromZatoshis("77")).toBe("0.00000077");
    expect(formatZecFromZatoshis("1")).toBe("0.00000001");
  });

  it("throws on malformed input instead of rounding silently", () => {
    expect(() => formatZecFromZatoshis("12.5")).toThrow();
    expect(() => formatZecFromZatoshis("")).toThrow();
  });
});
