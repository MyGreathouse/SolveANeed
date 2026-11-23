/**
 * Offer lifecycle (Phase 3). Mirrors public.offer_transition_allowed().
 */
export const OFFER_STATUSES = [
  "draft",
  "proposed",
  "countered",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "completed",
  "disputed",
] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_TRANSITIONS: Readonly<Record<OfferStatus, readonly OfferStatus[]>> = {
  draft: ["proposed", "cancelled"],
  proposed: ["countered", "accepted", "declined", "expired", "cancelled"],
  countered: ["countered", "accepted", "declined", "expired", "cancelled"],
  accepted: ["completed", "disputed", "cancelled"],
  disputed: ["completed", "cancelled"],
  declined: [],
  expired: [],
  cancelled: [],
  completed: [],
};

export function canTransitionOffer(from: OfferStatus, to: OfferStatus): boolean {
  return OFFER_TRANSITIONS[from].includes(to);
}

export const TERMINAL_OFFER_STATUSES = OFFER_STATUSES.filter((s) => OFFER_TRANSITIONS[s].length === 0);

export const OFFER_TYPES = ["gift", "paid_task", "milestone", "direct_support"] as const;
export type OfferType = (typeof OFFER_TYPES)[number];
