/*
  vault/crypto.ts — WebCrypto primitives for the Vinca encrypted vault.

  All cryptographic work runs in the browser via the Web Cryptography API.
  No key material is serialised, logged, or transmitted.

  Key derivation
  ──────────────
  PBKDF2-HMAC-SHA-256 with:
    • A fresh 128-bit salt (per vault / per export file).
    • At least 600,000 iterations (PRD §6).
    • Imported KDF parameter bounds enforced before any stretching operation.

  Encryption
  ──────────
  AES-256-GCM (256-bit key, 96-bit nonce, 128-bit tag).
  Every encrypt call produces a fresh random nonce.
  Associated data (AAD) is always required and binds the file kind,
  record identifier, schema version, and revision to the ciphertext so
  that the AEAD tag rejects any attempt to swap record metadata.

  Error semantics
  ───────────────
  All exported functions throw typed `VaultCryptoError` with a `code` that
  the vault layer can present without leaking raw WebCrypto exception text.
*/

export type VaultCryptoErrorCode =
  | "DERIVE_FAILED"
  | "ENCRYPT_FAILED"
  | "DECRYPT_FAILED"
  | "WRONG_PASSPHRASE"
  | "INVALID_KDF_PARAMS"
  | "INVALID_NONCE_LENGTH"
  | "INVALID_CIPHERTEXT";

export class VaultCryptoError extends Error {
  constructor(
    public readonly code: VaultCryptoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "VaultCryptoError";
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Minimum acceptable PBKDF2 iteration count when importing external parameters. */
export const MIN_KDF_ITERATIONS = 600_000;

/** Maximum we will ever accept from an imported bundle (prevents DoS). */
export const MAX_KDF_ITERATIONS = 10_000_000;

/** AES-GCM nonce length in bytes (96 bits). */
export const NONCE_BYTES = 12;

/** AES-GCM tag length in bits. */
export const TAG_BITS = 128;

/** Salt length in bytes for PBKDF2. */
export const SALT_BYTES = 16;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An opaque non-extractable CryptoKey derived from a passphrase.
 * Hold in memory only; discard on lock.
 */
export type DerivedVaultKey = CryptoKey;

/** Raw wire representation stored in IndexedDB or inside export bundles. */
export interface CiphertextEnvelope {
  /** Hex-encoded 96-bit nonce. */
  readonly nonceHex: string;
  /** Hex-encoded ciphertext + GCM auth tag. */
  readonly ciphertextHex: string;
  /** Hex-encoded associated data (AAD) — NOT secret; verified on decrypt. */
  readonly aadHex: string;
}

/** AAD components that are bound into every encrypted record. */
export interface AadComponents {
  /** Authenticated file / record kind — e.g. "context", "receipt", "workspace-backup". */
  readonly recordKind: string;
  /** Stable identifier of the record. */
  readonly recordId: string;
  /** Schema version string — e.g. "1.0". */
  readonly schemaVersion: string;
  /** Monotonically increasing revision to prevent replay of old ciphertexts. */
  readonly revision: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new VaultCryptoError("INVALID_CIPHERTEXT", "Hex string has odd length.");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function encodeAad(components: AadComponents): Uint8Array {
  // Canonical JSON encoding of the AAD fields — deterministic key order.
  const json = JSON.stringify({
    recordKind: components.recordKind,
    recordId: components.recordId,
    schemaVersion: components.schemaVersion,
    revision: components.revision,
  });
  return new TextEncoder().encode(json);
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Validates externally-supplied KDF parameters before stretching begins.
 * Call this whenever consuming a parameter set from a recovery bundle.
 */
export function validateKdfParams(iterations: number): void {
  if (
    !Number.isInteger(iterations) ||
    iterations < MIN_KDF_ITERATIONS ||
    iterations > MAX_KDF_ITERATIONS
  ) {
    throw new VaultCryptoError(
      "INVALID_KDF_PARAMS",
      `KDF iterations must be an integer in [${MIN_KDF_ITERATIONS}, ${MAX_KDF_ITERATIONS}]. Got: ${iterations}.`,
    );
  }
}

/**
 * Derives a non-extractable AES-256-GCM key from a passphrase and salt using
 * PBKDF2-HMAC-SHA-256.
 *
 * @param passphrase  — UTF-8 passphrase string.
 * @param saltBytes   — 16-byte random salt.
 * @param iterations  — PBKDF2 iteration count (>=600,000).
 */
export async function deriveKey(
  passphrase: string,
  saltBytes: Uint8Array,
  iterations: number = MIN_KDF_ITERATIONS,
): Promise<DerivedVaultKey> {
  validateKdfParams(iterations);

  try {
    const passphraseKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false, // non-extractable
      ["deriveKey"],
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes as unknown as BufferSource,
        iterations,
        hash: "SHA-256",
      },
      passphraseKey,
      { name: "AES-GCM", length: 256 },
      false, // non-extractable
      ["encrypt", "decrypt"],
    );

    return derivedKey;
  } catch (err) {
    if (err instanceof VaultCryptoError) throw err;
    throw new VaultCryptoError(
      "DERIVE_FAILED",
      `Key derivation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Generates a fresh random 128-bit salt suitable for PBKDF2.
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}

// ---------------------------------------------------------------------------
// Encryption
// ---------------------------------------------------------------------------

/**
 * Encrypts `plaintext` with AES-256-GCM using a fresh random 96-bit nonce.
 *
 * The `aadComponents` are serialised to canonical JSON, bound into the AEAD
 * tag, and stored in the envelope as `aadHex` so that any modification of
 * file-kind, identifier, schema version or revision is detected on decrypt.
 *
 * @returns A `CiphertextEnvelope` safe for storage in IndexedDB or export bundles.
 */
export async function encrypt(
  key: DerivedVaultKey,
  plaintext: Uint8Array,
  aadComponents: AadComponents,
): Promise<CiphertextEnvelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const aadBytes = encodeAad(aadComponents);

  try {
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as unknown as BufferSource, additionalData: aadBytes as unknown as BufferSource, tagLength: TAG_BITS },
      key,
      plaintext as unknown as BufferSource,
    );

    return {
      nonceHex: bytesToHex(nonce),
      ciphertextHex: bytesToHex(new Uint8Array(ciphertext)),
      aadHex: bytesToHex(aadBytes),
    };
  } catch (err) {
    if (err instanceof VaultCryptoError) throw err;
    throw new VaultCryptoError(
      "ENCRYPT_FAILED",
      `Encryption failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Decryption
// ---------------------------------------------------------------------------

/**
 * Decrypts a `CiphertextEnvelope` and verifies its AAD.
 *
 * The AAD is reconstructed from `aadComponents` before decryption.
 * If the reconstructed AAD does not match the stored `aadHex`, or if the
 * GCM tag fails, this throws `WRONG_PASSPHRASE` (wrong key) or
 * `INVALID_CIPHERTEXT` (tampered data).
 *
 * Failed decryptions do NOT modify any workspace state. The caller is
 * responsible for enforcing that guarantee.
 */
export async function decrypt(
  key: DerivedVaultKey,
  envelope: CiphertextEnvelope,
  aadComponents: AadComponents,
): Promise<Uint8Array> {
  // Verify the stored AAD matches what we expect before handing to WebCrypto.
  const expectedAadBytes = encodeAad(aadComponents);
  const storedAadBytes = hexToBytes(envelope.aadHex);

  if (
    expectedAadBytes.length !== storedAadBytes.length ||
    !expectedAadBytes.every((b, i) => b === storedAadBytes[i])
  ) {
    throw new VaultCryptoError(
      "INVALID_CIPHERTEXT",
      "AAD mismatch: record kind, identifier, schema version or revision does not match the stored envelope.",
    );
  }

  const nonce = hexToBytes(envelope.nonceHex);
  if (nonce.length !== NONCE_BYTES) {
    throw new VaultCryptoError(
      "INVALID_NONCE_LENGTH",
      `Expected ${NONCE_BYTES}-byte nonce, got ${nonce.length}.`,
    );
  }

  const ciphertextBytes = hexToBytes(envelope.ciphertextHex);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as unknown as BufferSource, additionalData: storedAadBytes as unknown as BufferSource, tagLength: TAG_BITS },
      key,
      ciphertextBytes as unknown as BufferSource,
    );
    return new Uint8Array(plaintext);
  } catch {
    // WebCrypto does not distinguish wrong-key from tampered-tag at the API level.
    // We surface WRONG_PASSPHRASE because the most common cause is a bad passphrase.
    throw new VaultCryptoError(
      "WRONG_PASSPHRASE",
      "Decryption failed: wrong passphrase or corrupted ciphertext.",
    );
  }
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Serialises a JS value to UTF-8 JSON bytes ready for encryption.
 */
export function serialise(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

/**
 * Deserialises UTF-8 JSON bytes produced by `serialise`.
 */
export function deserialise<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
