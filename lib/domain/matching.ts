/**
 * Explainable, rules-based matching (Phase 2 foundation).
 *
 * 1. Eligibility/safety filters run FIRST and remove needs entirely.
 * 2. Remaining needs are ranked by transparent rules, each producing a
 *    human-readable reason.
 *
 * The description text is deliberately NOT scored, so emotive or urgent
 * wording cannot buy a higher ranking. Deadlines are not used as an urgency
 * boost for the same reason.
 */

export interface MatchableNeed {
  id: string;
  category_slug: string;
  accepted_support_types: string[];
  currency: string;
  amount_minor: number;
  region: string | null;
  evidence_reviewed: boolean;
  requester_identity_verified: boolean;
  requester_id?: string;
}

export interface SupporterPreferences {
  userId: string;
  categories: string[];
  supportTypes: string[];
  regions: string[];
  currency: string | null;
  maxAmountMinor: number | null;
  requireEvidenceReviewed?: boolean;
}

export interface MatchResult<T extends MatchableNeed> {
  need: T;
  score: number;
  reasons: string[];
}

export const MATCH_WEIGHTS = {
  category: 30,
  supportType: 25,
  region: 15,
  withinBudget: 15,
  evidenceReviewed: 10,
  identityVerified: 5,
} as const;

export function isEligible(need: MatchableNeed, prefs: SupporterPreferences): boolean {
  if (need.requester_id && need.requester_id === prefs.userId) return false; // never match your own need
  if (prefs.requireEvidenceReviewed && !need.evidence_reviewed) return false;
  if (prefs.supportTypes.length > 0 && !need.accepted_support_types.some((t) => prefs.supportTypes.includes(t))) {
    return false; // the supporter can't help in any way this requester accepts
  }
  return true;
}

export function scoreNeed<T extends MatchableNeed>(need: T, prefs: SupporterPreferences): MatchResult<T> {
  const reasons: string[] = [];
  let score = 0;
  if (prefs.categories.includes(need.category_slug)) {
    score += MATCH_WEIGHTS.category;
    reasons.push("Matches a category you follow");
  }
  if (prefs.supportTypes.length > 0 && need.accepted_support_types.some((t) => prefs.supportTypes.includes(t))) {
    score += MATCH_WEIGHTS.supportType;
    reasons.push("Accepts the kind of help you offer");
  }
  if (need.region && prefs.regions.includes(need.region)) {
    score += MATCH_WEIGHTS.region;
    reasons.push(`In ${need.region}`);
  }
  if (prefs.currency && prefs.maxAmountMinor != null && need.currency === prefs.currency && need.amount_minor <= prefs.maxAmountMinor) {
    score += MATCH_WEIGHTS.withinBudget;
    reasons.push("Within your budget");
  }
  if (need.evidence_reviewed) {
    score += MATCH_WEIGHTS.evidenceReviewed;
    reasons.push("Evidence reviewed by a moderator");
  }
  if (need.requester_identity_verified) {
    score += MATCH_WEIGHTS.identityVerified;
    reasons.push("Requester identity verified");
  }
  return { need, score, reasons };
}

/** Filters, scores and sorts. Ties keep the input order (e.g. newest first). */
export function rankNeeds<T extends MatchableNeed>(needs: T[], prefs: SupporterPreferences): MatchResult<T>[] {
  return needs
    .filter((n) => isEligible(n, prefs))
    .map((n, i) => ({ result: scoreNeed(n, prefs), i }))
    .sort((a, b) => b.result.score - a.result.score || a.i - b.i)
    .map(({ result }) => result);
}
