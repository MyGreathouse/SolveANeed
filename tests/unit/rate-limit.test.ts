import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));

const { subjectHash } = await import("@/lib/security/rate-limit");

describe("rate-limit subject hashing", () => {
  it("produces a 64-char hex digest that never contains the raw subject", () => {
    const h = subjectHash("sign_in_email", "Amara@Example.com", "pepper");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("amara");
  });
  it("is case- and whitespace-insensitive for the same subject", () => {
    expect(subjectHash("x", " A@B.com ", "p")).toBe(subjectHash("x", "a@b.com", "p"));
  });
  it("differs by action and by pepper", () => {
    expect(subjectHash("a", "s", "p")).not.toBe(subjectHash("b", "s", "p"));
    expect(subjectHash("a", "s", "p1")).not.toBe(subjectHash("a", "s", "p2"));
  });
});
