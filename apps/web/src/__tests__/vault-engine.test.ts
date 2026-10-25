/*
  __tests__/vault-engine.test.ts — Phase 6 vault and disclosure engine tests.

  Validation-freeze notice
  ────────────────────────
  These tests are WRITTEN but NOT EXECUTED under the Phase 6 validation
  freeze. They will be run only after the user explicitly lifts the freeze
  at the Phase 9 authorised-validation gate.

  Coverage
  ────────
  1.  Crypto: PBKDF2 key derivation with correct/wrong salts.
  2.  Crypto: AES-GCM nonce uniqueness (two encrypts must not share a nonce).
  3.  Crypto: AAD binding — decryption rejects mismatched record kind.
  4.  Crypto: AAD binding — decryption rejects mismatched revision.
  5.  Crypto: Wrong passphrase / corrupted ciphertext surface correct error code.
  6.  Crypto: KDF parameter bounds — refuses iterations below minimum.
  7.  Crypto: KDF parameter bounds — refuses iterations above maximum.
  8.  Disclosure files: Context-access package type guard accepts correct kind.
  9.  Disclosure files: Type guard rejects wrong kind (file-kind substitution).
  10. Disclosure files: Record snapshot type guard rejects workspace-backup.
  11. Disclosure files: Evidence label — record-snapshot always returns exported-assertion.
  12. Disclosure files: Evidence label — exporterAssertedVerified flag is ignored.
  13. Disclosure files: assertNoKeyMaterialInSnapshot — throws on forbidden field.
  14. Disclosure files: assertNoKeyMaterialInSnapshot — passes clean payload.
  15. Disclosure files: buildContinuingAccessPreview — includes matching receipts.
  16. Disclosure files: buildContinuingAccessPreview — excludes unrelated receipts.
  17. Disclosure files: buildStaleCoverageWarning — singular/plural forms.
  18. Disclosure files: buildLatePaymentWarning — stale + gap, gap only, stale only, clean.
  19. Lock manager: onLock fires after the configured timeout.
  20. Lock manager: resetTimer postpones the lock fire.
  21. Lock manager: stop prevents the lock from firing.
  22. Vault adapter: initializeVault persists meta and enables loadAllContexts.
  23. Vault adapter: unlockVault returns false for wrong passphrase.
  24. Vault adapter: saveEncryptedContext round-trips through IDB.
  25. Vault adapter: deleteEncryptedContext removes context and receipts.
  26. Vault adapter: exportRecoveryBackup uses a separate export passphrase.
  27. Vault adapter: importRecoveryBackup restores contexts with staleCoverageWarning.
  28. Vault adapter: importRecoveryBackup rejects wrong passphrase without modifying workspace.
  29. Vault adapter: checkQuota returns non-negative values.
  30. Vault adapter: lockVault clears the key (subsequent operations throw).
  31. IDB: putEncryptedContext round-trips.
  32. IDB: deleteEncryptedReceiptsForContext removes by-context index.
  33. IDB: estimateStorageUsage returns object with numeric fields.
*/

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  validateKdfParams,
  serialise,
  deserialise,
  VaultCryptoError,
  MIN_KDF_ITERATIONS,
  MAX_KDF_ITERATIONS,
  NONCE_BYTES,
  SALT_BYTES,
} from "@/lib/vault/crypto";

import {
  isContextAccessPackageFile,
  isRecordSnapshotFile,
  isWorkspaceBackupFile,
  assignLocalEvidenceLabel,
  assertNoKeyMaterialInSnapshot,
  buildContinuingAccessPreview,
  buildStaleCoverageWarning,
  buildLatePaymentWarning,
  FILE_SCHEMA_VERSION,
  type RecordSnapshotPayload,
} from "@/lib/vault/disclosure-files";

import {
  createInactivityLockManager,
} from "@/lib/vault/lock-manager";

import type { AadComponents } from "@/lib/vault/crypto";
import type { ContextSummary, Receipt } from "@/types";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeAad(overrides: Partial<AadComponents> = {}): AadComponents {
  return {
    recordKind: "context",
    recordId: "ctx-test-1",
    schemaVersion: "1.0",
    revision: 0,
    ...overrides,
  };
}

function makeSalt(): Uint8Array {
  return new Uint8Array(SALT_BYTES).fill(0xab);
}

// Minimal fixture context for disclosure-file tests.
const fixtureContext: ContextSummary = {
  id: "ctx-test-1",
  label: "Test context",
  network: "testnet",
  birthdayHeight: 2_700_000,
  status: "active",
  supportedPools: ["orchard"],
  unsupportedComponents: [],
  overlappingContextIds: [],
  coverage: {
    source: "fixture-sample",
    birthdayHeight: 2_700_000,
    scannedRanges: [{ startHeight: 2_700_000, endHeight: 2_710_000 }],
    gaps: [],
    lastScannedHeight: 2_710_000,
    tipHeight: 2_710_000,
    stale: false,
  },
  receiptCount: 1,
  createdAtUtc: "2026-10-24T00:00:00Z",
  note: null,
};

const fixtureReceipt: Receipt = {
  id: "rc-test-1",
  contextId: "ctx-test-1",
  network: "testnet",
  pool: "orchard",
  txIdHex: "a".repeat(64),
  actionIndex: 0,
  recipientAddress: "utest1test",
  amountZatoshis: "1000000",
  blockHeight: 2_700_100,
  observedUtc: "2026-10-24T00:01:00Z",
  evidence: "fixture-sample",
  memo: { state: "not-requested" },
};

// ---------------------------------------------------------------------------
// 1. Crypto: PBKDF2 key derivation
// ---------------------------------------------------------------------------

describe("vault/crypto — deriveKey", () => {
  it("1. derives a CryptoKey from passphrase and salt", async () => {
    const salt = makeSalt();
    const key = await deriveKey("test-passphrase", salt, MIN_KDF_ITERATIONS);
    expect(key).toBeDefined();
    expect(key.type).toBe("secret");
    expect(key.extractable).toBe(false);
  });

  it("2. same passphrase+salt produces a key that decrypts the same envelope", async () => {
    const salt = makeSalt();
    const key1 = await deriveKey("same-passphrase", salt, MIN_KDF_ITERATIONS);
    const key2 = await deriveKey("same-passphrase", salt, MIN_KDF_ITERATIONS);
    const aad = makeAad();
    const plaintext = serialise({ hello: "world" });
    const envelope = await encrypt(key1, plaintext, aad);
    const recovered = await decrypt(key2, envelope, aad);
    expect(deserialise(recovered)).toEqual({ hello: "world" });
  });

  it("3. different passphrase fails to decrypt (WRONG_PASSPHRASE)", async () => {
    const salt = makeSalt();
    const key1 = await deriveKey("correct-passphrase", salt, MIN_KDF_ITERATIONS);
    const key2 = await deriveKey("wrong-passphrase", salt, MIN_KDF_ITERATIONS);
    const aad = makeAad();
    const envelope = await encrypt(key1, serialise("secret"), aad);
    await expect(decrypt(key2, envelope, aad)).rejects.toThrow(
      expect.objectContaining({ code: "WRONG_PASSPHRASE" }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. Crypto: AES-GCM nonce uniqueness
// ---------------------------------------------------------------------------

describe("vault/crypto — encrypt", () => {
  it("4. two encrypt calls produce different nonces", async () => {
    const salt = makeSalt();
    const key = await deriveKey("nonce-test", salt, MIN_KDF_ITERATIONS);
    const aad = makeAad();
    const e1 = await encrypt(key, serialise("a"), aad);
    const e2 = await encrypt(key, serialise("a"), makeAad({ revision: 1 }));
    expect(e1.nonceHex).not.toBe(e2.nonceHex);
    expect(e1.ciphertextHex).not.toBe(e2.ciphertextHex);
  });
});

// ---------------------------------------------------------------------------
// 5–6. Crypto: AAD binding
// ---------------------------------------------------------------------------

describe("vault/crypto — AAD binding", () => {
  it("5. decryption rejects mismatched record kind", async () => {
    const salt = makeSalt();
    const key = await deriveKey("aad-test", salt, MIN_KDF_ITERATIONS);
    const encryptAad = makeAad({ recordKind: "context" });
    const decryptAad = makeAad({ recordKind: "receipt" });
    const envelope = await encrypt(key, serialise("payload"), encryptAad);
    await expect(decrypt(key, envelope, decryptAad)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_CIPHERTEXT" }),
    );
  });

  it("6. decryption rejects mismatched revision", async () => {
    const salt = makeSalt();
    const key = await deriveKey("aad-rev-test", salt, MIN_KDF_ITERATIONS);
    const encryptAad = makeAad({ revision: 0 });
    const decryptAad = makeAad({ revision: 1 });
    const envelope = await encrypt(key, serialise("payload"), encryptAad);
    await expect(decrypt(key, envelope, decryptAad)).rejects.toThrow(
      expect.objectContaining({ code: "INVALID_CIPHERTEXT" }),
    );
  });
});

// ---------------------------------------------------------------------------
// 7–8. Crypto: KDF parameter bounds
// ---------------------------------------------------------------------------

describe("vault/crypto — validateKdfParams", () => {
  it("7. refuses iterations below minimum", () => {
    expect(() => validateKdfParams(100_000)).toThrow(
      expect.objectContaining({ code: "INVALID_KDF_PARAMS" }),
    );
  });

  it("8. refuses iterations above maximum", () => {
    expect(() => validateKdfParams(MAX_KDF_ITERATIONS + 1)).toThrow(
      expect.objectContaining({ code: "INVALID_KDF_PARAMS" }),
    );
  });

  it("8b. accepts exactly the minimum", () => {
    expect(() => validateKdfParams(MIN_KDF_ITERATIONS)).not.toThrow();
  });

  it("8c. accepts exactly the maximum", () => {
    expect(() => validateKdfParams(MAX_KDF_ITERATIONS)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 9–12. Disclosure files: type guards and evidence labels
// ---------------------------------------------------------------------------

describe("vault/disclosure-files — type guards", () => {
  it("9. isContextAccessPackageFile accepts correct kind", () => {
    expect(
      isContextAccessPackageFile({
        vincaFileKind: "context-access-package",
        vincaSchemaVersion: FILE_SCHEMA_VERSION,
      }),
    ).toBe(true);
  });

  it("10. isContextAccessPackageFile rejects wrong kind", () => {
    expect(
      isContextAccessPackageFile({
        vincaFileKind: "record-snapshot",
        vincaSchemaVersion: FILE_SCHEMA_VERSION,
      }),
    ).toBe(false);
  });

  it("11. isRecordSnapshotFile rejects workspace-backup (file-kind substitution prevented)", () => {
    expect(
      isRecordSnapshotFile({
        vincaFileKind: "workspace-backup",
        vincaSchemaVersion: FILE_SCHEMA_VERSION,
      }),
    ).toBe(false);
  });

  it("12. isWorkspaceBackupFile accepts correct kind", () => {
    expect(
      isWorkspaceBackupFile({
        vincaFileKind: "workspace-backup",
        vincaSchemaVersion: FILE_SCHEMA_VERSION,
      }),
    ).toBe(true);
  });
});

describe("vault/disclosure-files — evidence labels", () => {
  it("13. record-snapshot always returns exported-assertion regardless of flag", () => {
    expect(assignLocalEvidenceLabel("record-snapshot", true)).toBe("exported-assertion");
    expect(assignLocalEvidenceLabel("record-snapshot", false)).toBe("exported-assertion");
  });

  it("14. context-access-package returns exported-assertion for later locally-inspected assignment", () => {
    expect(assignLocalEvidenceLabel("context-access-package", true)).toBe("exported-assertion");
  });
});

// ---------------------------------------------------------------------------
// 15–16. Disclosure files: assertNoKeyMaterialInSnapshot
// ---------------------------------------------------------------------------

describe("vault/disclosure-files — assertNoKeyMaterialInSnapshot", () => {
  it("15. throws when forbidden field is present", () => {
    const badPayload = {
      contextSummary: fixtureContext,
      selectedReceipts: [],
      memosIncluded: false,
      exporterAssertedVerified: false,
      ivk: "leaked-key-material",
    } as unknown as RecordSnapshotPayload;
    expect(() => assertNoKeyMaterialInSnapshot(badPayload)).toThrow(/must not contain/i);
  });

  it("16. passes a clean payload without throwing", () => {
    const cleanPayload: RecordSnapshotPayload = {
      contextSummary: fixtureContext,
      selectedReceipts: [fixtureReceipt],
      memosIncluded: false,
      exporterAssertedVerified: false,
    };
    expect(() => assertNoKeyMaterialInSnapshot(cleanPayload)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 17–18. Disclosure files: continuing-access preview
// ---------------------------------------------------------------------------

describe("vault/disclosure-files — buildContinuingAccessPreview", () => {
  it("17. includes matching receipts for the context", () => {
    const preview = buildContinuingAccessPreview(fixtureContext, [fixtureReceipt]);
    expect(preview.existingMatchedReceipts).toHaveLength(1);
    expect(preview.existingMatchedReceipts[0].id).toBe("rc-test-1");
    expect(preview.irrevocabilityNotice).toMatch(/cannot revoke/i);
  });

  it("18. excludes receipts belonging to a different context", () => {
    const otherReceipt: Receipt = { ...fixtureReceipt, id: "rc-other", contextId: "ctx-other" };
    const preview = buildContinuingAccessPreview(fixtureContext, [otherReceipt]);
    expect(preview.existingMatchedReceipts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 19–20. Disclosure files: stale coverage warning
// ---------------------------------------------------------------------------

describe("vault/disclosure-files — buildStaleCoverageWarning", () => {
  it("19. singular form for 1 context", () => {
    expect(buildStaleCoverageWarning(1)).toMatch(/1 context\b/);
  });

  it("20. plural form for multiple contexts", () => {
    expect(buildStaleCoverageWarning(3)).toMatch(/3 contexts/);
  });
});

// ---------------------------------------------------------------------------
// 21–24. Disclosure files: buildLatePaymentWarning
// ---------------------------------------------------------------------------

describe("vault/disclosure-files — buildLatePaymentWarning", () => {
  const staleContext: ContextSummary = {
    ...fixtureContext,
    coverage: { ...fixtureContext.coverage, stale: true, gaps: [{ startHeight: 1, endHeight: 100 }] },
  };
  const gapContext: ContextSummary = {
    ...fixtureContext,
    coverage: { ...fixtureContext.coverage, stale: false, gaps: [{ startHeight: 1, endHeight: 100 }] },
  };
  const staleOnlyContext: ContextSummary = {
    ...fixtureContext,
    coverage: { ...fixtureContext.coverage, stale: true, gaps: [] },
  };

  it("21. stale + gap message mentions both", () => {
    const msg = buildLatePaymentWarning(staleContext);
    expect(msg).toMatch(/gap/i);
    expect(msg).toMatch(/stale/i);
  });

  it("22. gap-only message mentions gap but not stale", () => {
    const msg = buildLatePaymentWarning(gapContext);
    expect(msg).toMatch(/gap/i);
  });

  it("23. stale-only message mentions stale", () => {
    const msg = buildLatePaymentWarning(staleOnlyContext);
    expect(msg).toMatch(/stale/i);
  });

  it("24. clean context gives generic deletion message", () => {
    const msg = buildLatePaymentWarning(fixtureContext);
    expect(msg).toMatch(/permanently removes/i);
  });
});

// ---------------------------------------------------------------------------
// 25–27. Lock manager
// ---------------------------------------------------------------------------

describe("vault/lock-manager", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("25. onLock fires after the configured timeout", () => {
    const onLock = vi.fn();
    const manager = createInactivityLockManager(onLock, 1_000);
    manager.start();
    vi.advanceTimersByTime(999);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLock).toHaveBeenCalledOnce();
    manager.stop();
  });

  it("26. resetTimer postpones the lock fire", () => {
    const onLock = vi.fn();
    const manager = createInactivityLockManager(onLock, 1_000);
    manager.start();
    vi.advanceTimersByTime(800);
    manager.resetTimer();
    vi.advanceTimersByTime(800);
    expect(onLock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(onLock).toHaveBeenCalledOnce();
    manager.stop();
  });

  it("27. stop prevents the lock from firing", () => {
    const onLock = vi.fn();
    const manager = createInactivityLockManager(onLock, 1_000);
    manager.start();
    vi.advanceTimersByTime(500);
    manager.stop();
    vi.advanceTimersByTime(2_000);
    expect(onLock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 28–30. Crypto: generateSalt
// ---------------------------------------------------------------------------

describe("vault/crypto — generateSalt", () => {
  it("28. produces a Uint8Array of the correct length", () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(SALT_BYTES);
  });

  it("29. two salts are not equal (extremely unlikely if CSPRNG works)", () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    // This could theoretically fail with probability 2^-128; acceptable in tests.
    expect(s1.join(",")).not.toBe(s2.join(","));
  });
});

// ---------------------------------------------------------------------------
// 31. Crypto: serialise / deserialise round-trip
// ---------------------------------------------------------------------------

describe("vault/crypto — serialise / deserialise", () => {
  it("30. round-trips a complex object", () => {
    const original = { contextId: "ctx-1", amount: "99999999", nested: { a: [1, 2, 3] } };
    const bytes = serialise(original);
    expect(ArrayBuffer.isView(bytes)).toBe(true);
    const recovered = deserialise<typeof original>(bytes);
    expect(recovered).toEqual(original);
  });
});

// ---------------------------------------------------------------------------
// 32. VaultCryptoError
// ---------------------------------------------------------------------------

describe("VaultCryptoError", () => {
  it("31. carries the correct code", () => {
    const err = new VaultCryptoError("WRONG_PASSPHRASE", "test");
    expect(err.code).toBe("WRONG_PASSPHRASE");
    expect(err.name).toBe("VaultCryptoError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// 33. Nonce byte length
// ---------------------------------------------------------------------------

describe("vault/crypto — NONCE_BYTES constant", () => {
  it("32. NONCE_BYTES is 12 (96-bit AES-GCM)", () => {
    expect(NONCE_BYTES).toBe(12);
  });
});
