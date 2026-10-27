/*
  Worker protocol and client adapter test suite (PRD Phase 5).
  Written under the validation freeze; execution remains deferred.
*/

import { describe, expect, it } from "vitest";
import { VincaWorkerClient } from "@/adapters/worker-client";
import type { OpaqueKeyHandle } from "@/adapters/types";
import { assertDecryptedMemo, MAX_TRANSACTION_BYTES, parseRawTransactionHex } from "@/lib/memo";

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

describe("Memo transaction and lossless-result bounds", () => {
  it("decodes bounded raw V5/V6 hex without interpreting JSON or compact data", () => {
    expect(parseRawTransactionHex("05000080A0ff")).toEqual(new Uint8Array([5, 0, 0, 128, 160, 255]));
    expect(parseRawTransactionHex("06000080")).toEqual(new Uint8Array([6, 0, 0, 128]));
    for (const input of ["", "0", "05000080zz", '{"hex":"05000080"}', "0500 0080", "0x05000080", "08041200"]) {
      expect(() => parseRawTransactionHex(input)).toThrow();
    }
  });

  it("checks decoded size before allocation and accepts the exact 2 MiB ceiling", () => {
    expect(() => parseRawTransactionHex("05000080" + "00".repeat(MAX_TRANSACTION_BYTES - 3))).toThrow(/2 MiB/);
    expect(parseRawTransactionHex("05000080" + "00".repeat(MAX_TRANSACTION_BYTES - 4))).toHaveLength(MAX_TRANSACTION_BYTES);
  });

  it("requires all 512 original memo bytes and keeps nontext formats distinct", () => {
    const validMemos = [
      { format: "text", text: "hello", rawBytesHex: "68656c6c6f" + "00".repeat(507) },
      { format: "text", text: "", rawBytesHex: "00".repeat(512) },
      { format: "no-memo", text: "", rawBytesHex: "f6" + "00".repeat(511) },
      { format: "arbitrary-bytes", text: "", rawBytesHex: "ff" + "00".repeat(511) },
      { format: "future-format", text: "", rawBytesHex: "f7" + "00".repeat(511) },
      { format: "legacy-nontext", text: "", rawBytesHex: "f5" + "00".repeat(511) },
    ];
    for (const memo of validMemos) {
      expect(() => assertDecryptedMemo(memo)).not.toThrow();
    }
    for (const memo of [
      { format: "text", text: "missing raw bytes" },
      { format: "text", text: "", rawBytesHex: "00" },
      { format: "text", text: "", rawBytesHex: "AB".repeat(512) },
      { format: "no-memo", text: "invented text", rawBytesHex: "f6" + "00".repeat(511) },
      { format: "no-memo", text: "", rawBytesHex: "00".repeat(512) },
      { format: "text", text: "other", rawBytesHex: "68656c6c6f" + "00".repeat(507) },
      { format: "text", text: "x".repeat(513), rawBytesHex: "00".repeat(512) },
      { format: "unknown", text: "", rawBytesHex: "00".repeat(512) },
      { format: "future-format", text: "", rawBytesHex: "f6" + "00".repeat(511) },
    ]) {
      expect(() => assertDecryptedMemo(memo)).toThrow();
    }
  });
});
