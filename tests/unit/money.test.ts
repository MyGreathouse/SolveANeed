import { describe, expect, it } from "vitest";
import {
  MoneyError, addMoney, allocate, calculateFee, formatMoney, minorToMajorString, parseMajorToMinor, progressBasisPoints,
} from "@/lib/money";

describe("parseMajorToMinor", () => {
  it.each([
    ["1200", 2, 120000],
    ["1,200.50", 2, 120050],
    ["£75", 2, 7500],
    ["0.1", 2, 10],
    ["19.99", 2, 1999],
    ["5000", 0, 5000],
    ["12.345", 3, 12345],
    ["007.5", 2, 750],
  ])("parses %s (exp %i) → %i", (input, exp, expected) => {
    expect(parseMajorToMinor(input, exp)).toBe(expected);
  });

  it("never introduces float errors (0.1 + 0.2 style)", () => {
    expect(parseMajorToMinor("0.29", 2)).toBe(29); // 0.29 * 100 = 28.999999999999996 in floats
    expect(parseMajorToMinor("1.15", 2)).toBe(115);
  });

  it.each([["12.345", 2], ["10.5", 0], ["abc", 2], ["-5", 2], ["", 2], ["1e5", 2]])("rejects %s", (input, exp) => {
    expect(() => parseMajorToMinor(input, exp)).toThrow(MoneyError);
  });
});

describe("formatting", () => {
  it("round-trips minor units to major strings", () => {
    expect(minorToMajorString(120050, 2)).toBe("1200.50");
    expect(minorToMajorString(5, 2)).toBe("0.05");
    expect(minorToMajorString(5000, 0)).toBe("5000");
    expect(minorToMajorString(12345, 3)).toBe("12.345");
  });

  it("formats each currency with its own exponent", () => {
    expect(formatMoney({ amountMinor: 120000, currency: "GBP" })).toBe("£1,200");
    expect(formatMoney({ amountMinor: 120050, currency: "GBP" })).toBe("£1,200.50");
    expect(formatMoney({ amountMinor: 5000, currency: "JPY" })).toBe("¥5,000");
    expect(formatMoney({ amountMinor: 12345, currency: "KWD" })).toMatch(/12\.345/);
    expect(formatMoney({ amountMinor: 100000000, currency: "NGN" })).toBe("₦1,000,000");
  });
});

describe("arithmetic", () => {
  it("refuses to add different currencies", () => {
    expect(() => addMoney({ amountMinor: 1, currency: "GBP" }, { amountMinor: 1, currency: "USD" })).toThrow(MoneyError);
  });

  it("computes progress in integer basis points, capped at 100%", () => {
    expect(progressBasisPoints({ amountMinor: 1, currency: "GBP" }, { amountMinor: 3, currency: "GBP" })).toBe(3333);
    expect(progressBasisPoints({ amountMinor: 500, currency: "GBP" }, { amountMinor: 100, currency: "GBP" })).toBe(10000);
  });

  it("calculates a 5% fee with half-up rounding and exact net", () => {
    const { fee, net } = calculateFee({ amountMinor: 30000, currency: "GBP" }, 500);
    expect(fee.amountMinor).toBe(1500);
    expect(net.amountMinor).toBe(28500);
    const odd = calculateFee({ amountMinor: 1010, currency: "GBP" }, 500); // 50.5 → 51
    expect(odd.fee.amountMinor + odd.net.amountMinor).toBe(1010);
    expect(odd.fee.amountMinor).toBe(51);
  });

  it("allocates milestones so parts always sum to the total", () => {
    const parts = allocate({ amountMinor: 100000, currency: "GBP" }, [1, 1, 2]);
    expect(parts.map((p) => p.amountMinor)).toEqual([25000, 25000, 50000]);
    const thirds = allocate({ amountMinor: 100, currency: "GBP" }, [1, 1, 1]);
    expect(thirds.reduce((s, p) => s + p.amountMinor, 0)).toBe(100);
    expect(thirds.map((p) => p.amountMinor)).toEqual([34, 33, 33]);
  });
});
