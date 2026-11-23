/**
 * Agreement lifecycle (Phase 3). Mirrors public.agreement_transition_allowed().
 * Funding is separate: see FUNDING_LABEL — an agreement is never shown as
 * funded unless the database reports a provider-confirmed live payment.
 */
export const AGREEMENT_STATUSES = [
  "awaiting_payment_readiness",
  "active",
  "submitted",
  "revision_requested",
  "in_review",
  "completed",
  "cancelled",
  "lapsed",
  "disputed",
] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export const AGREEMENT_TRANSITIONS: Readonly<Record<AgreementStatus, readonly AgreementStatus[]>> = {
  awaiting_payment_readiness: ["active", "cancelled", "lapsed"],
  active: ["submitted", "completed", "cancelled", "disputed"],
  submitted: ["completed", "revision_requested", "disputed"],
  revision_requested: ["submitted", "cancelled", "disputed"],
  disputed: ["completed", "cancelled"],
  in_review: [],
  completed: [],
  cancelled: [],
  lapsed: [],
};

export function canTransitionAgreement(from: AgreementStatus, to: AgreementStatus): boolean {
  return AGREEMENT_TRANSITIONS[from].includes(to);
}

export const AGREEMENT_STATUS_LABEL: Record<AgreementStatus, string> = {
  awaiting_payment_readiness: "Agreed — not funded",
  active: "In progress",
  submitted: "Work submitted",
  revision_requested: "Revision requested",
  in_review: "In review",
  completed: "Completed",
  cancelled: "Cancelled",
  lapsed: "Lapsed",
  disputed: "In dispute",
};

export type FundingStatus = "funded" | "not_funded";
export const FUNDING_LABEL: Record<FundingStatus, string> = {
  funded: "Funded (provider-confirmed)",
  not_funded: "Not funded — no money has moved",
};
