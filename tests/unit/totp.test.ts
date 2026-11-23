import { describe, expect, it } from "vitest";
import { totp } from "../support/totp";

// RFC 6238 Appendix B test vectors (SHA-1, secret "12345678901234567890"), truncated to 6 digits.
const SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("TOTP helper used by MFA tests", () => {
  it.each([
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
  ])("t=%i → %s", (t, expected) => {
    expect(totp(SECRET, t * 1000)).toBe(expected);
  });
});
