/** Static catalogue data shared by UI and validation. Mirrors seeded reference tables. */

export const CATEGORIES = [
  { slug: "education", label: "Education" },
  { slug: "employment", label: "Employment" },
  { slug: "skills-training", label: "Skills and Training" },
  { slug: "small-business", label: "Small Business" },
  { slug: "essential-equipment", label: "Essential Equipment" },
  { slug: "community-projects", label: "Community Projects" },
  { slug: "other", label: "Other Approved Needs" },
] as const;
export type CategorySlug = (typeof CATEGORIES)[number]["slug"];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as [CategorySlug, ...CategorySlug[]];
export const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.label ?? "Other";

export const SUPPORT_TYPES = [
  { value: "gift", label: "Give", pillar: "GIVE", description: "Unconditional financial support." },
  { value: "paid_task", label: "Earn", pillar: "EARN", description: "Paid, agreed remote tasks." },
  { value: "milestone", label: "Fund", pillar: "FUND", description: "Sponsorship released at agreed milestones." },
  { value: "direct_support", label: "Solve", pillar: "SOLVE", description: "Equipment, training or expertise provided directly." },
] as const;
export type SupportType = (typeof SUPPORT_TYPES)[number]["value"];
export const SUPPORT_TYPE_VALUES = SUPPORT_TYPES.map((s) => s.value) as [SupportType, ...SupportType[]];
export const supportTypeLabel = (v: string) => SUPPORT_TYPES.find((s) => s.value === v)?.label ?? v;

/** UK regions (NUTS1 + nations). General location only — never addresses. */
export const UK_REGIONS = [
  "North East",
  "North West",
  "Yorkshire and the Humber",
  "East Midlands",
  "West Midlands",
  "East of England",
  "London",
  "South East",
  "South West",
  "Wales",
  "Scotland",
  "Northern Ireland",
  "Remote / UK-wide",
] as const;

export const FUNDING_PROGRESS_FILTERS = [
  { value: "any", label: "Any progress" },
  { value: "not_started", label: "Not yet supported" },
  { value: "under_half", label: "Under 50% funded" },
  { value: "over_half", label: "50% or more funded" },
] as const;
