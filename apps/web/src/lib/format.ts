/*
  Exact decimal-string money helpers (prd.md: integer zatoshis with
  decimal-string transport; no floating-point balance arithmetic).

  ZEC = 10^8 zatoshis.
*/

const ZATOSHI_PER_ZEC = 100_000_000n;
const MAX_FRACTION_DIGITS = 8;

/**
 * Format an integer-zatoshis decimal string as a ZEC decimal string,
 * using only BigInt arithmetic. Throws on malformed input rather than
 * rounding silently.
 */
export function formatZecFromZatoshis(amountZatoshis: string): string {
  if (!/^-?\d+$/.test(amountZatoshis)) {
    throw new Error(`Malformed zatoshis value: ${amountZatoshis}`);
  }

  const negative = amountZatoshis.startsWith("-");
  const absolute = BigInt(negative ? amountZatoshis.slice(1) : amountZatoshis);
  const whole = absolute / ZATOSHI_PER_ZEC;
  const fraction = absolute % ZATOSHI_PER_ZEC;

  let fractionDigits = fraction.toString().padStart(MAX_FRACTION_DIGITS, "0");
  // Trim trailing zeros so whole zatoshis render as whole ZEC.
  fractionDigits = fractionDigits.replace(/0+$/, "");

  const sign = negative && absolute !== 0n ? "-" : "";
  return fractionDigits.length > 0
    ? `${sign}${whole}.${fractionDigits}`
    : `${sign}${whole}`;
}

/** Shorten long hex identifiers (transaction ids, addresses) for table display. */
export function shortHex(hex: string, visible = 6): string {
  if (hex.length <= visible * 2 + 1) return hex;
  return `${hex.slice(0, visible)}…${hex.slice(-visible)}`;
}

/**
 * Exact BigInt sum of integer zatoshis string array.
 */
export function sumZatoshis(amounts: readonly string[]): string {
  const total = amounts.reduce((acc, curr) => {
    if (!/^-?\d+$/.test(curr)) {
      throw new Error(`Malformed zatoshis value: ${curr}`);
    }
    return acc + BigInt(curr);
  }, 0n);
  return total.toString();
}
