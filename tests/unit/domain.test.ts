import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { NEED_STATUSES, NEED_TRANSITIONS, canTransitionNeed } from "@/lib/domain/need-status";
import { OFFER_STATUSES, OFFER_TRANSITIONS, canTransitionOffer } from "@/lib/domain/offer-status";
import { AGREEMENT_TRANSITIONS, canTransitionAgreement } from "@/lib/domain/agreement-status";
import { OFFER_STATUS_LABEL, parseOfferForm, screeningWarning } from "@/lib/domain/offers";
import { rankNeeds, type MatchableNeed, type SupporterPreferences } from "@/lib/domain/matching";
import { checkReadyToSubmit, exploreFiltersSchema, needDraftSchema, signUpSchema, toNeedRow } from "@/lib/domain/validation";

const migrations = path.resolve(import.meta.dirname, "../../supabase/migrations");

/** Extracts ('from','to') pairs from a SQL transition function body. */
function sqlTransitions(file: string, fn: string): Set<string> {
  const sql = readFileSync(path.join(migrations, file), "utf8");
  const start = sql.indexOf(`function public.${fn}`);
  const body = sql.slice(start, sql.indexOf("$$;", start));
  const pairs = [...body.matchAll(/\('([a-z_]+)'(?:::[a-z_.]+)?,\s*'([a-z_]+)'(?:::[a-z_.]+)?\)/g)];
  return new Set(pairs.map((m) => `${m[1]}>${m[2]}`));
}

function tsTransitions(map: Record<string, readonly string[]>): Set<string> {
  return new Set(Object.entries(map).flatMap(([from, tos]) => tos.map((to) => `${from}>${to}`)));
}

describe("state machines stay in sync with the database", () => {
  it("need transitions match public.need_transition_allowed()", () => {
    expect(tsTransitions(NEED_TRANSITIONS)).toEqual(sqlTransitions("20261123090100_needs.sql", "need_transition_allowed"));
  });
  it("offer transitions match public.offer_transition_allowed()", () => {
    expect(tsTransitions(OFFER_TRANSITIONS)).toEqual(
      sqlTransitions("20261123090200_agreements_payments.sql", "offer_transition_allowed"),
    );
  });
  it("agreement transitions match public.agreement_transition_allowed()", () => {
    expect(tsTransitions(AGREEMENT_TRANSITIONS)).toEqual(
      sqlTransitions("20261124090100_offers_agreements_messaging.sql", "agreement_transition_allowed"),
    );
    expect(canTransitionAgreement("awaiting_payment_readiness", "completed")).toBe(false);
  });
  it("requesters cannot jump from draft to published", () => {
    expect(canTransitionNeed("draft", "published")).toBe(false);
    expect(canTransitionNeed("pending_review", "published")).toBe(true);
  });
  it("terminal states have no exits", () => {
    for (const s of ["rejected", "closed"] as const) expect(NEED_TRANSITIONS[s]).toHaveLength(0);
    expect(canTransitionOffer("completed", "disputed")).toBe(false);
    expect(OFFER_STATUSES).toContain("countered");
    expect(NEED_STATUSES).toHaveLength(7);
  });
});

describe("matching", () => {
  const base: MatchableNeed = {
    id: "a", category_slug: "education", accepted_support_types: ["gift"], currency: "GBP",
    amount_minor: 50000, region: "London", evidence_reviewed: false, requester_identity_verified: false,
  };
  const prefs: SupporterPreferences = {
    userId: "me", categories: ["education"], supportTypes: ["gift"], regions: ["London"], currency: "GBP", maxAmountMinor: 100000,
  };

  it("filters ineligible needs before ranking", () => {
    const own = { ...base, id: "own", requester_id: "me" };
    const wrongType = { ...base, id: "task-only", accepted_support_types: ["paid_task"] };
    expect(rankNeeds([own, wrongType, base], prefs).map((r) => r.need.id)).toEqual(["a"]);
  });

  it("ranks by transparent rules and explains each match", () => {
    const weaker = { ...base, id: "b", category_slug: "small-business", region: "Wales" };
    const [first, second] = rankNeeds([weaker, base], prefs);
    expect(first.need.id).toBe("a");
    expect(first.reasons).toContain("Matches a category you follow");
    expect(first.score).toBeGreaterThan(second.score);
  });

  it("does not let urgent wording affect the score", () => {
    const urgent = { ...base, id: "urgent", description: "URGENT!!! PLEASE HELP NOW" } as MatchableNeed;
    const [x, y] = rankNeeds([base, urgent], prefs);
    expect(x.score).toBe(y.score);
  });
});

describe("validation", () => {
  const goodDraft = {
    title: "Laptop for a coding course",
    categorySlug: "skills-training",
    description: "x".repeat(100),
    amount: "650",
    currency: "GBP",
    intendedUse: "To buy a laptop for coursework.",
    region: "London",
    acceptedSupportTypes: ["gift", "paid_task"],
    deadline: "",
    visibility: "public",
    showRequesterName: true,
  };

  it("converts the amount to minor units", () => {
    const parsed = needDraftSchema.parse(goodDraft);
    const { row, errors } = toNeedRow(parsed);
    expect(errors).toEqual({});
    expect(row.amount_minor).toBe(65000);
  });

  it("rejects disabled currencies and too many decimals", () => {
    expect(toNeedRow(needDraftSchema.parse({ ...goodDraft, currency: "JPY" })).errors.currency).toBeTruthy();
    expect(toNeedRow(needDraftSchema.parse({ ...goodDraft, amount: "10.123" })).errors.amount).toBeTruthy();
  });

  it("enforces per-currency limits before submission", () => {
    const { row } = toNeedRow(needDraftSchema.parse({ ...goodDraft, amount: "5" }));
    expect(checkReadyToSubmit(row, "2026-01-01").amount).toMatch(/between £10 and £25,000/);
  });

  it("requires the 18+ confirmation and a strong password", () => {
    const r = signUpSchema.safeParse({
      displayName: "Ada", email: "ada@example.com", password: "short", intent: "need", termsAccepted: "on",
    });
    expect(r.success).toBe(false);
    const issues = r.error!.issues.map((i) => i.path[0]);
    expect(issues).toContain("ageConfirmed");
    expect(issues).toContain("password");
  });

  it("silently drops invalid explore filters", () => {
    const f = exploreFiltersSchema.parse({ category: "<script>", currency: "gbp", page: "2" });
    expect(f).toEqual({ category: undefined, currency: undefined, page: 2 });
  });

  it("strips control characters from free text", () => {
    const parsed = needDraftSchema.parse({ ...goodDraft, title: "Hello\u0007 world" });
    expect(parsed.title).toBe("Hello world");
  });
});

describe("offer forms", () => {
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };
  const future = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);

  it("an accepted offer is never labelled as funded", () => {
    expect(OFFER_STATUS_LABEL.accepted).toBe("Agreed — not funded");
    expect(Object.values(OFFER_STATUS_LABEL).some((l) => /^Funded/.test(l))).toBe(false);
  });

  it("parses a gift in minor units without floating point", () => {
    const r = parseOfferForm("gift", fd({ amount: "19.99", message: "Good luck" }), 2);
    expect(r).toEqual({ ok: true, value: { type: "gift", amountMinor: 1999, terms: { message: "Good luck" } } });
    expect(parseOfferForm("gift", fd({ amount: "0" }), 2).ok).toBe(false);
    expect(parseOfferForm("gift", fd({ amount: "1.234" }), 2)).toMatchObject({ ok: false, errors: { amount: expect.any(String) } });
  });

  it("paid tasks require remote work, deliverables and criteria", () => {
    const base = { amount: "80", title: "Logo design", description: "A clean logo for a small home bakery business.", deliverables: "Concepts\nFinal files", deadline: future, acceptance_criteria: "Delivered as PNG and SVG files.", max_revisions: "2" };
    expect(parseOfferForm("paid_task", fd(base), 2)).toMatchObject({ ok: false, errors: { remote_only: expect.any(String) } });
    const ok = parseOfferForm("paid_task", fd({ ...base, remote_only: "on" }), 2);
    expect(ok).toMatchObject({ ok: true, value: { amountMinor: 8000, terms: { deliverables: ["Concepts", "Final files"], max_revisions: 2 } } });
  });

  it("milestone totals come from the milestones themselves", () => {
    const r = parseOfferForm("milestone", fd({
      m0_title: "Enrol", m0_criteria: "Enrolment confirmation", m0_evidence: "Letter", m0_amount: "100.50", m0_due: future,
      m1_title: "Finish", m1_criteria: "Course certificate issued", m1_evidence: "Certificate", m1_amount: "49.50", m1_due: future,
    }), 2);
    expect(r).toMatchObject({ ok: true, value: { amountMinor: 15000 } });
  });

  it("direct support is non-cash and must be online or public", () => {
    const base = { kind: "mentoring", description: "Weekly interview practice over video call." };
    expect(parseOfferForm("direct_support", fd(base), 2).ok).toBe(false);
    expect(parseOfferForm("direct_support", fd({ ...base, online_or_public_only: "on" }), 2)).toMatchObject({ ok: true, value: { amountMinor: 0 } });
  });

  it("explains screening flags without repeating the member's text", () => {
    expect(screeningWarning([])).toBeNull();
    expect(screeningWarning(["phone_number", "off_platform_payment"])).toMatch(/phone number and a mention of paying outside/);
  });
});
