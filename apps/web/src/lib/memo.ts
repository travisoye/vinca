import type { WorkerDecryptedMemoResult } from "@/adapters/types";

export const MAX_TRANSACTION_BYTES = 2 * 1024 * 1024;

export function parseRawTransactionHex(input: string): Uint8Array {
  if (input.length > MAX_TRANSACTION_BYTES * 2) {
    throw new Error("Raw transaction exceeds the 2 MiB decoded limit.");
  }
  const hex = input.trim();
  if (!hex.length || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("Paste only an even-length raw transaction hex string, not JSON or an RPC envelope.");
  }
  if (!/^(05000080|06000080)/i.test(hex)) {
    throw new Error("A full serialized V5 or V6 transaction is required, not compact-block or protobuf data.");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function assertDecryptedMemo(value: unknown): asserts value is WorkerDecryptedMemoResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("The worker returned an invalid or incomplete memo result.");
  }
  const memo = value as Record<string, unknown>;
  if (
    typeof memo.format !== "string" ||
    !["text", "no-memo", "arbitrary-bytes", "future-format", "legacy-nontext"].includes(memo.format) ||
    typeof memo.text !== "string" ||
    new TextEncoder().encode(memo.text).length > 512 ||
    (memo.format !== "text" && memo.text !== "") ||
    typeof memo.rawBytesHex !== "string" ||
    !/^[0-9a-f]{1024}$/.test(memo.rawBytesHex)
  ) {
    throw new Error("The worker returned an invalid or incomplete memo result.");
  }

  const rawBytes = new Uint8Array(512);
  for (let i = 0; i < rawBytes.length; i++) {
    rawBytes[i] = Number.parseInt(memo.rawBytesHex.slice(i * 2, i * 2 + 2), 16);
  }

  const firstByte = rawBytes[0];
  const isNoMemoSentinel =
    firstByte === 0xf6 && rawBytes.subarray(1).every((byte) => byte === 0);
  const isTextFormat = firstByte <= 0xf4;
  const isFutureFormat =
    (firstByte === 0xf6 && !isNoMemoSentinel) ||
    (firstByte >= 0xf7 && firstByte <= 0xfe);
  let matchesFormat = false;

  switch (memo.format) {
    case "text": {
      if (isTextFormat) {
        try {
          const decodedText = new TextDecoder("utf-8", { fatal: true })
            .decode(rawBytes)
            .replace(/\0+$/, "");
          matchesFormat = decodedText === memo.text;
        } catch {
          matchesFormat = false;
        }
      }
      break;
    }
    case "no-memo":
      matchesFormat = isNoMemoSentinel;
      break;
    case "arbitrary-bytes":
      matchesFormat = firstByte === 0xff;
      break;
    case "future-format":
      matchesFormat = isFutureFormat;
      break;
    case "legacy-nontext":
      matchesFormat = firstByte === 0xf5;
      break;
  }

  if (!matchesFormat) {
    throw new Error("The worker returned memo bytes inconsistent with the declared format.");
  }
}
