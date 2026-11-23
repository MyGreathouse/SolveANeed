/**
 * Need lifecycle. Mirrors public.need_transition_allowed() in the database,
 * which is the authoritative enforcement point. Unit tests keep them aligned.
 */
export const NEED_STATUSES = [
  "draft",
  "pending_review",
  "changes_requested",
  "published",
  "rejected",
  "closed",
  "suspended",
] as const;
export type NeedStatus = (typeof NEED_STATUSES)[number];

export const NEED_TRANSITIONS: Readonly<Record<NeedStatus, readonly NeedStatus[]>> = {
  draft: ["pending_review"],
  changes_requested: ["pending_review", "closed"],
  pending_review: ["published", "changes_requested", "rejected"],
  published: ["closed", "suspended"],
  suspended: ["published", "closed"],
  rejected: [],
  closed: [],
};

export function canTransitionNeed(from: NeedStatus, to: NeedStatus): boolean {
  return NEED_TRANSITIONS[from].includes(to);
}

/** Statuses in which the requester may edit content and evidence. */
export const EDITABLE_NEED_STATUSES: readonly NeedStatus[] = ["draft", "changes_requested"];
export const isNeedEditable = (s: NeedStatus) => EDITABLE_NEED_STATUSES.includes(s);

export const NEED_STATUS_LABEL: Record<NeedStatus, string> = {
  draft: "Draft",
  pending_review: "Awaiting review",
  changes_requested: "Changes requested",
  published: "Live",
  rejected: "Not approved",
  closed: "Closed",
  suspended: "Suspended",
};

export const NEED_STATUS_TONE: Record<NeedStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  pending_review: "info",
  changes_requested: "warning",
  published: "success",
  rejected: "danger",
  closed: "neutral",
  suspended: "danger",
};

export const MODERATION_ACTIONS = [
  "approve",
  "request_changes",
  "reject",
  "suspend",
  "reinstate",
  "mark_evidence_reviewed",
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];
export const MODERATION_ACTIONS_REQUIRING_NOTE: readonly ModerationAction[] = ["request_changes", "reject", "suspend"];
