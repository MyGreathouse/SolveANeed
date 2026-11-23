import { z } from "zod";
import { CATEGORY_SLUGS, SUPPORT_TYPE_VALUES, UK_REGIONS, type SupportType } from "./catalog";
import { DEFAULT_CURRENCIES, MoneyError, getCurrency, isWithinNeedLimits, parseMajorToMinor, formatMoney } from "../money";
import type { CurrencyInfo } from "../money";

/** Strips control characters (except newlines/tabs) from free text. */
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Keep this under ${max} characters`));

// ---------------------------------------------------------------- accounts
export const signUpSchema = z.object({
  displayName: text(60).pipe(z.string().min(2, "Enter the name you'd like others to see")),
  email: z.email("Enter a valid email address").max(254),
  password: z
    .string()
    .min(12, "Use at least 12 characters")
    .max(128)
    .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), "Include at least one letter and one number"),
  intent: z.enum(["need", "help", "both"]),
  ageConfirmed: z.literal("on", { error: "You must be 18 or over to join SolveANeed" }),
  termsAccepted: z.literal("on", { error: "Please accept the Terms and Privacy Notice" }),
});

export const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});

export const emailOnlySchema = z.object({ email: z.email("Enter a valid email address") });

export const newPasswordSchema = z
  .object({ password: signUpSchema.shape.password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const profileSchema = z.object({
  displayName: signUpSchema.shape.displayName,
  bio: text(1000),
  region: z.union([z.literal(""), z.enum(UK_REGIONS)]),
  preferredCurrency: z.string().regex(/^[A-Z]{3}$/),
});

// ------------------------------------------------------------------- needs
export const needDraftSchema = z.object({
  title: text(120).pipe(z.string().min(3, "Give your need a short title")),
  categorySlug: z.enum(CATEGORY_SLUGS, { error: "Choose a category" }),
  description: text(5000),
  amount: z.string().trim(),
  currency: z.string().regex(/^[A-Z]{3}$/, "Choose a currency"),
  intendedUse: text(2000),
  region: z.union([z.literal(""), z.enum(UK_REGIONS)]),
  acceptedSupportTypes: z.array(z.enum(SUPPORT_TYPE_VALUES)).max(4),
  deadline: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")]),
  visibility: z.enum(["public", "members_only"]),
  showRequesterName: z.boolean(),
});
export type NeedDraftInput = z.infer<typeof needDraftSchema>;

export interface NeedRow {
  title: string;
  category_slug: string;
  description: string;
  amount_minor: number | null;
  currency: string;
  intended_use: string | null;
  region: string | null;
  accepted_support_types: SupportType[];
  deadline: string | null;
  visibility: "public" | "members_only";
  show_requester_name: boolean;
}

export type FieldErrors = Partial<Record<keyof NeedDraftInput | "form", string>>;

/** Converts validated form input into a database row (amount → minor units). */
export function toNeedRow(
  input: NeedDraftInput,
  currencies: readonly CurrencyInfo[] = DEFAULT_CURRENCIES,
): { row: NeedRow; errors: FieldErrors } {
  const errors: FieldErrors = {};
  let amountMinor: number | null = null;
  let info: CurrencyInfo | undefined;
  try {
    info = getCurrency(input.currency, currencies);
    if (!info.enabled) errors.currency = "This currency is not available yet";
  } catch {
    errors.currency = "Choose a supported currency";
  }
  if (input.amount !== "" && info) {
    try {
      amountMinor = parseMajorToMinor(input.amount, info.minorUnit);
      if (amountMinor <= 0) errors.amount = "Enter an amount greater than zero";
    } catch (e) {
      errors.amount = e instanceof MoneyError ? e.message : "Enter a valid amount";
    }
  }
  return {
    errors,
    row: {
      title: input.title,
      category_slug: input.categorySlug,
      description: input.description,
      amount_minor: amountMinor,
      currency: input.currency,
      intended_use: input.intendedUse || null,
      region: input.region || null,
      accepted_support_types: input.acceptedSupportTypes,
      deadline: input.deadline || null,
      visibility: input.visibility,
      show_requester_name: input.showRequesterName,
    },
  };
}

/**
 * Pre-submission completeness check (friendly messages). The database
 * function public.submit_need() re-checks everything authoritatively.
 */
export function checkReadyToSubmit(
  row: NeedRow,
  today: string,
  currencies: readonly CurrencyInfo[] = DEFAULT_CURRENCIES,
): FieldErrors {
  const e: FieldErrors = {};
  if (row.title.trim().length < 10) e.title = "Use at least 10 characters so supporters understand the need";
  if (row.description.trim().length < 80) e.description = "Describe the need in at least 80 characters";
  if ((row.intended_use ?? "").trim().length < 20) e.intendedUse = "Explain how the support will be used (20+ characters)";
  if (row.accepted_support_types.length === 0) e.acceptedSupportTypes = "Choose at least one way people can help";
  if (row.deadline && row.deadline <= today) e.deadline = "Choose a date in the future";
  const info = currencies.find((c) => c.code === row.currency);
  if (!info || !info.enabled) e.currency = "Choose a supported currency";
  else if (row.amount_minor == null) e.amount = "Enter the amount you need";
  else if (!isWithinNeedLimits({ amountMinor: row.amount_minor, currency: row.currency }, info)) {
    const min = formatMoney({ amountMinor: info.minNeedMinor, currency: info.code }, { list: currencies });
    const max = formatMoney({ amountMinor: info.maxNeedMinor, currency: info.code }, { list: currencies });
    e.amount = `Requests in ${info.code} must be between ${min} and ${max}`;
  }
  return e;
}

// ---------------------------------------------------------------- explore
export const exploreFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.enum(CATEGORY_SLUGS).optional().catch(undefined),
  support: z.enum(SUPPORT_TYPE_VALUES).optional().catch(undefined),
  region: z.enum(UK_REGIONS).optional().catch(undefined),
  currency: z.string().regex(/^[A-Z]{3}$/).optional().catch(undefined),
  min: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  max: z.string().regex(/^\d+(\.\d+)?$/).optional().catch(undefined),
  progress: z.enum(["any", "not_started", "under_half", "over_half"]).optional().catch(undefined),
  verified: z.enum(["evidence", "identity"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type ExploreFilters = z.infer<typeof exploreFiltersSchema>;

// ---------------------------------------------------------------- reports
export const reportSchema = z.object({
  targetType: z.enum(["need", "profile", "message", "offer"]),
  targetId: z.uuid(),
  reason: z.enum(["fraud_or_scam", "misleading", "inappropriate", "harassment", "duplicate", "prohibited_request", "other"]),
  details: text(2000),
});

export const uuidSchema = z.uuid();
