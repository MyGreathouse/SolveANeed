/**
 * Money handling for SolveANeed.
 *
 * Every amount is an integer number of MINOR units (pence, cents, kobo…)
 * paired with an ISO 4217 currency code. Floating-point arithmetic is never
 * used for money. Amounts in different currencies are never combined.
 */

export type CurrencyCode = string; // ISO 4217, upper-case, 3 letters

export interface CurrencyInfo {
  code: CurrencyCode;
  name: string;
  symbol: string;
  /** ISO 4217 exponent: number of decimal places (GBP 2, JPY 0, KWD 3). */
  minorUnit: number;
  enabled: boolean;
  minNeedMinor: number;
  maxNeedMinor: number;
}

export interface Money {
  amountMinor: number;
  currency: CurrencyCode;
}

/**
 * Fallback reference data — mirrors the `currencies` table seeded in
 * migration 20261123090000. The database is the source of truth at runtime.
 */
export const DEFAULT_CURRENCIES: readonly CurrencyInfo[] = [
  { code: "GBP", name: "British pound", symbol: "£", minorUnit: 2, enabled: true, minNeedMinor: 1000, maxNeedMinor: 2_500_000 },
  { code: "EUR", name: "Euro", symbol: "€", minorUnit: 2, enabled: true, minNeedMinor: 1000, maxNeedMinor: 3_000_000 },
  { code: "USD", name: "US dollar", symbol: "$", minorUnit: 2, enabled: true, minNeedMinor: 1000, maxNeedMinor: 3_000_000 },
  { code: "NGN", name: "Nigerian naira", symbol: "₦", minorUnit: 2, enabled: true, minNeedMinor: 1_000_000, maxNeedMinor: 5_000_000_000 },
  { code: "CAD", name: "Canadian dollar", symbol: "CA$", minorUnit: 2, enabled: false, minNeedMinor: 1500, maxNeedMinor: 4_000_000 },
  { code: "AUD", name: "Australian dollar", symbol: "A$", minorUnit: 2, enabled: false, minNeedMinor: 1500, maxNeedMinor: 4_500_000 },
  { code: "JPY", name: "Japanese yen", symbol: "¥", minorUnit: 0, enabled: false, minNeedMinor: 2000, maxNeedMinor: 5_000_000 },
  { code: "KWD", name: "Kuwaiti dinar", symbol: "KD", minorUnit: 3, enabled: false, minNeedMinor: 4000, maxNeedMinor: 8_000_000 },
];

export const DEFAULT_CURRENCY: CurrencyCode = "GBP";

export function getCurrency(code: CurrencyCode, list: readonly CurrencyInfo[] = DEFAULT_CURRENCIES): CurrencyInfo {
  const c = list.find((x) => x.code === code);
  if (!c) throw new MoneyError(`Unsupported currency: ${code}`);
  return c;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertSafeInteger(n: number, label = "amount"): void {
  if (!Number.isSafeInteger(n)) throw new MoneyError(`${label} must be a safe integer of minor units`);
}

/**
 * Parses a user-entered major-unit string ("1,200.50", "£75", "300") into
 * minor units using string arithmetic only.
 */
export function parseMajorToMinor(input: string, minorUnit: number): number {
  const cleaned = input.trim().replace(/[\s,£€$₦¥]/g, "").replace(/^(CA|A|KD)/i, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) throw new MoneyError("Enter an amount using numbers only, for example 1200 or 1200.50");
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > minorUnit) {
    throw new MoneyError(minorUnit === 0 ? "This currency does not use decimal places" : `Use at most ${minorUnit} decimal places`);
  }
  const digits = (whole.replace(/^0+(?=\d)/, "") + frac.padEnd(minorUnit, "0")).replace(/^0+(?=\d)/, "");
  const value = Number(digits);
  assertSafeInteger(value);
  return value;
}

/** Converts minor units to a plain major-unit string ("1200.50") for form inputs. */
export function minorToMajorString(amountMinor: number, minorUnit: number): string {
  assertSafeInteger(amountMinor);
  const negative = amountMinor < 0;
  const abs = Math.abs(amountMinor).toString().padStart(minorUnit + 1, "0");
  const whole = minorUnit === 0 ? abs : abs.slice(0, -minorUnit);
  const frac = minorUnit === 0 ? "" : abs.slice(-minorUnit);
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

/**
 * Formats money for display. Uses Intl with the currency's own exponent so
 * no float multiplication/division happens on the stored value.
 */
export function formatMoney(
  money: Money,
  opts: { locale?: string; compact?: boolean; list?: readonly CurrencyInfo[] } = {},
): string {
  const info = getCurrency(money.currency, opts.list);
  const major = minorToMajorString(money.amountMinor, info.minorUnit);
  const isWhole = info.minorUnit === 0 || /\.0+$/.test(major);
  const fmt = new Intl.NumberFormat(opts.locale ?? "en-GB", {
    style: "currency",
    currency: info.code,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: isWhole ? 0 : info.minorUnit,
    maximumFractionDigits: info.minorUnit,
    notation: opts.compact ? "compact" : "standard",
  });
  // Intl accepts decimal strings (ES2023), which avoids float rounding on display.
  return fmt.format(major as unknown as number);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) throw new MoneyError("Cannot add amounts in different currencies");
  const sum = a.amountMinor + b.amountMinor;
  assertSafeInteger(sum, "sum");
  return { amountMinor: sum, currency: a.currency };
}

/** Integer percentage in basis points (0–10000), floored, capped at 100%. */
export function progressBasisPoints(funded: Money, target: Money): number {
  if (funded.currency !== target.currency) throw new MoneyError("Progress requires the same currency");
  if (target.amountMinor <= 0) return 0;
  return Math.min(10_000, Math.floor((funded.amountMinor * 10_000) / target.amountMinor));
}

/**
 * Platform fee on a completed paid task, in basis points (500 = 5%).
 * Rounds half-up to the nearest minor unit; never exceeds the amount.
 */
export function calculateFee(amount: Money, feeBps: number): { fee: Money; net: Money } {
  assertSafeInteger(amount.amountMinor);
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) throw new MoneyError("Fee must be 0–10000 basis points");
  const fee = Math.floor((amount.amountMinor * feeBps + 5_000) / 10_000);
  return {
    fee: { amountMinor: fee, currency: amount.currency },
    net: { amountMinor: amount.amountMinor - fee, currency: amount.currency },
  };
}

/**
 * Splits an amount into parts (e.g. milestones) by integer weights so the
 * parts always sum exactly to the total (largest-remainder method).
 */
export function allocate(amount: Money, weights: number[]): Money[] {
  if (weights.length === 0 || weights.some((w) => !Number.isInteger(w) || w < 0)) {
    throw new MoneyError("Weights must be non-negative integers");
  }
  const total = weights.reduce((s, w) => s + w, 0);
  if (total === 0) throw new MoneyError("Weights must not all be zero");
  // Exact integer arithmetic: quotient and remainder of (amount × weight) / total.
  const products = weights.map((w) => {
    const p = amount.amountMinor * w;
    assertSafeInteger(p, "allocation");
    return p;
  });
  const floors = products.map((p) => (p - (p % total)) / total);
  let remainder = amount.amountMinor - floors.reduce((s, v) => s + v, 0);
  const order = products.map((p, i) => ({ i, rem: p % total })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] += 1;
    remainder -= 1;
  }
  return floors.map((v) => ({ amountMinor: v, currency: amount.currency }));
}

export function isWithinNeedLimits(money: Money, info: CurrencyInfo): boolean {
  return money.amountMinor >= info.minNeedMinor && money.amountMinor <= info.maxNeedMinor;
}
