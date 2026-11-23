import { z } from "zod";
import { MoneyError, parseMajorToMinor } from "@/lib/money";
import type { OfferStatus } from "./offer-status";
import type { SupportType } from "./catalog";

/**
 * Offer form parsing (Phase 3). The database re-validates and normalises
 * every field (private.normalise_offer_terms); these checks give members
 * clear, immediate messages.
 */
export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  draft: "Draft",
  proposed: "Awaiting response",
  countered: "Counter-offer",
  accepted: "Agreed — not funded",
  declined: "Declined",
  expired: "Expired",
  cancelled: "Withdrawn or cancelled",
  completed: "Completed",
  disputed: "In dispute",
};

const text = (label: string, min: number, max: number) =>
  z.string().trim().min(min, `${label} must be at least ${min} characters`).max(max, `${label} must be ${max} characters or fewer`);
const optionalText = (label: string, max: number) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`).optional().transform((v) => v || undefined);
const date = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Enter a valid ${label.toLowerCase()}`);

export const giftTermsSchema = z.object({ message: optionalText("Message", 2000) });

export const paidTaskTermsSchema = z.object({
  title: text("Task title", 5, 120),
  description: text("Task description", 20, 4000),
  deliverables: z.array(text("Each deliverable", 3, 300)).min(1, "List at least one deliverable").max(10, "List up to 10 deliverables"),
  deadline: date("Deadline"),
  acceptance_criteria: text("Acceptance criteria", 10, 2000),
  max_revisions: z.coerce.number().int().min(0).max(5),
  cancellation_policy: optionalText("Cancellation policy", 1000),
  remote_only: z.literal(true, "Paid tasks on SolveANeed must be remote"),
  message: optionalText("Message", 2000),
});

export const milestoneSchema = z.object({
  title: text("Milestone title", 3, 120),
  criteria: text("Milestone criteria", 10, 1000),
  evidence: text("Evidence required", 5, 500),
  amount_minor: z.number().int().positive("Each milestone needs an amount"),
  due_date: date("Due date"),
});
export const milestoneTermsSchema = z.object({
  milestones: z.array(milestoneSchema).min(1, "Add at least one milestone").max(10, "Add up to 10 milestones"),
  message: optionalText("Message", 2000),
});

export const directSupportTermsSchema = z.object({
  kind: z.enum(["time", "expertise", "mentoring"], "Choose time, expertise or mentoring"),
  description: text("Description", 20, 2000),
  schedule: optionalText("Schedule", 500),
  online_or_public_only: z.literal(true, "Direct support must take place online or in a public place"),
  message: optionalText("Message", 2000),
});

export type OfferInput = { type: SupportType; amountMinor: number; terms: Record<string, unknown> };
export type OfferParse = { ok: true; value: OfferInput } | { ok: false; errors: Record<string, string> };

const s = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" ? v : "";
};

function firstErrors(error: z.ZodError, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = prefix + (issue.path.length ? issue.path.join(".") : "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

function money(input: string, minorUnit: number, field: string): { ok: true; v: number } | { ok: false; errors: Record<string, string> } {
  try {
    return { ok: true, v: parseMajorToMinor(input, minorUnit) };
  } catch (e) {
    return { ok: false, errors: { [field]: e instanceof MoneyError ? e.message : "Enter a valid amount" } };
  }
}

/** Reads the offer/counter-offer form for a given support type. */
export function parseOfferForm(type: SupportType, fd: FormData, minorUnit: number): OfferParse {
  if (type === "gift") {
    const amount = money(s(fd, "amount"), minorUnit, "amount");
    if (!amount.ok) return amount;
    if (amount.v <= 0) return { ok: false, errors: { amount: "Enter an amount" } };
    const t = giftTermsSchema.safeParse({ message: s(fd, "message") });
    return t.success ? { ok: true, value: { type, amountMinor: amount.v, terms: t.data } } : { ok: false, errors: firstErrors(t.error) };
  }
  if (type === "paid_task") {
    const amount = money(s(fd, "amount"), minorUnit, "amount");
    if (!amount.ok) return amount;
    if (amount.v <= 0) return { ok: false, errors: { amount: "Enter the task price" } };
    const t = paidTaskTermsSchema.safeParse({
      title: s(fd, "title"),
      description: s(fd, "description"),
      deliverables: s(fd, "deliverables").split("\n").map((l) => l.trim()).filter(Boolean),
      deadline: s(fd, "deadline"),
      acceptance_criteria: s(fd, "acceptance_criteria"),
      max_revisions: s(fd, "max_revisions") || "1",
      cancellation_policy: s(fd, "cancellation_policy"),
      remote_only: fd.get("remote_only") === "on" ? true : undefined,
      message: s(fd, "message"),
    });
    return t.success ? { ok: true, value: { type, amountMinor: amount.v, terms: t.data } } : { ok: false, errors: firstErrors(t.error) };
  }
  if (type === "milestone") {
    const rows: unknown[] = [];
    const errors: Record<string, string> = {};
    for (let i = 0; i < 10; i++) {
      const title = s(fd, `m${i}_title`).trim();
      if (!title && !s(fd, `m${i}_amount`).trim()) continue;
      const amount = money(s(fd, `m${i}_amount`), minorUnit, `milestones.${rows.length}.amount_minor`);
      if (!amount.ok) Object.assign(errors, amount.errors);
      rows.push({
        title,
        criteria: s(fd, `m${i}_criteria`),
        evidence: s(fd, `m${i}_evidence`),
        amount_minor: amount.ok ? amount.v : 0,
        due_date: s(fd, `m${i}_due`),
      });
    }
    if (Object.keys(errors).length) return { ok: false, errors };
    const t = milestoneTermsSchema.safeParse({ milestones: rows, message: s(fd, "message") });
    if (!t.success) return { ok: false, errors: firstErrors(t.error) };
    const total = t.data.milestones.reduce((sum, m) => sum + m.amount_minor, 0);
    return { ok: true, value: { type, amountMinor: total, terms: t.data } };
  }
  const t = directSupportTermsSchema.safeParse({
    kind: s(fd, "kind"),
    description: s(fd, "description"),
    schedule: s(fd, "schedule"),
    online_or_public_only: fd.get("online_or_public_only") === "on" ? true : undefined,
    message: s(fd, "message"),
  });
  return t.success ? { ok: true, value: { type, amountMinor: 0, terms: t.data } } : { ok: false, errors: firstErrors(t.error) };
}

/** Friendly messages for the warnings the database returns after screening text. */
export const SCREENING_WARNINGS: Record<string, string> = {
  email_address: "an email address",
  phone_number: "a phone number",
  off_platform_contact: "a request to talk outside SolveANeed",
  off_platform_payment: "a mention of paying outside SolveANeed",
};
export function screeningWarning(flags: string[] | null | undefined): string | null {
  const parts = (flags ?? []).map((f) => SCREENING_WARNINGS[f]).filter(Boolean);
  if (!parts.length) return null;
  return `Sent, but it contains ${parts.join(" and ")}. Keep conversations and payments on SolveANeed — we can only protect you here. Our team may review flagged messages.`;
}
