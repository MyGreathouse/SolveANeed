import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { DEFAULT_CURRENCIES, getCurrency, parseMajorToMinor, type CurrencyInfo } from "@/lib/money";
import type { ExploreFilters } from "@/lib/domain/validation";
import type { NeedStatus } from "@/lib/domain/need-status";

export interface PublicNeed {
  id: string;
  title: string;
  category_slug: string;
  description: string;
  amount_minor: number;
  currency: string;
  intended_use: string | null;
  region: string | null;
  accepted_support_types: string[];
  deadline: string | null;
  visibility: "public" | "members_only";
  funded_minor: number;
  funding_basis_points: number;
  published_at: string;
  evidence_reviewed: boolean;
  outcome_confirmed: boolean;
  requester_name: string | null;
  requester_identity_verified: boolean;
}

export interface OwnNeed {
  id: string;
  requester_id: string;
  title: string;
  category_slug: string;
  description: string;
  amount_minor: number | null;
  currency: string;
  intended_use: string | null;
  region: string | null;
  accepted_support_types: string[];
  deadline: string | null;
  visibility: "public" | "members_only";
  show_requester_name: boolean;
  status: NeedStatus;
  funded_minor: number;
  funding_basis_points: number;
  moderation_note: string | null;
  evidence_reviewed_at: string | null;
  submitted_at: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvidenceFile {
  id: string;
  need_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

const PUBLIC_COLUMNS =
  "id, title, category_slug, description, amount_minor, currency, intended_use, region, accepted_support_types, deadline, visibility, funded_minor, funding_basis_points, published_at, evidence_reviewed, outcome_confirmed, requester_name, requester_identity_verified";

export const PAGE_SIZE = 12;

/** Currencies from the database (source of truth), falling back to built-in reference data. */
export const getCurrencies = cache(async (): Promise<CurrencyInfo[]> => {
  if (!isSupabaseConfigured()) return [...DEFAULT_CURRENCIES];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("currencies")
    .select("code, name, symbol, minor_unit, enabled, min_need_minor, max_need_minor")
    .order("sort_order");
  if (error || !data?.length) return [...DEFAULT_CURRENCIES];
  return data.map((c) => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    minorUnit: c.minor_unit,
    enabled: c.enabled,
    minNeedMinor: Number(c.min_need_minor),
    maxNeedMinor: Number(c.max_need_minor),
  }));
});

/** Escapes user search text for a PostgREST websearch tsquery. */
function sanitiseSearch(q: string): string {
  return q.replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

export async function listPublishedNeeds(
  filters: ExploreFilters,
  opts: { limit?: number } = {},
): Promise<{ needs: PublicNeed[]; total: number; page: number; available: boolean }> {
  const page = filters.page ?? 1;
  const limit = opts.limit ?? PAGE_SIZE;
  if (!isSupabaseConfigured()) return { needs: [], total: 0, page, available: false };

  const supabase = await createClient();
  const currencies = await getCurrencies();
  let query = supabase.from("needs_public").select(PUBLIC_COLUMNS, { count: "exact" });

  if (filters.category) query = query.eq("category_slug", filters.category);
  if (filters.support) query = query.contains("accepted_support_types", [filters.support]);
  if (filters.region) query = query.eq("region", filters.region);
  if (filters.verified === "evidence") query = query.eq("evidence_reviewed", true);
  if (filters.verified === "identity") query = query.eq("requester_identity_verified", true);
  if (filters.progress === "not_started") query = query.eq("funding_basis_points", 0);
  if (filters.progress === "under_half") query = query.lt("funding_basis_points", 5000);
  if (filters.progress === "over_half") query = query.gte("funding_basis_points", 5000);
  if (filters.q) {
    const q = sanitiseSearch(filters.q);
    if (q) query = query.textSearch("search", q, { type: "websearch", config: "english" });
  }
  // Amount filters only make sense within one currency — never compare across currencies.
  if (filters.currency) {
    query = query.eq("currency", filters.currency);
    const info = currencies.find((c) => c.code === filters.currency);
    if (info) {
      try {
        if (filters.min) query = query.gte("amount_minor", parseMajorToMinor(filters.min, info.minorUnit));
        if (filters.max) query = query.lte("amount_minor", parseMajorToMinor(filters.max, info.minorUnit));
      } catch {
        /* invalid amount filters are ignored */
      }
    }
  }

  const from = (page - 1) * limit;
  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + limit - 1);
  if (error) {
    console.error("[needs] listPublishedNeeds failed", error.code);
    return { needs: [], total: 0, page, available: false };
  }
  return { needs: (data ?? []) as PublicNeed[], total: count ?? 0, page, available: true };
}

export async function getPublicNeed(id: string): Promise<PublicNeed | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("needs_public").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();
  return (data as PublicNeed | null) ?? null;
}

const OWN_COLUMNS =
  "id, requester_id, title, category_slug, description, amount_minor, currency, intended_use, region, accepted_support_types, deadline, visibility, show_requester_name, status, funded_minor, funding_basis_points, moderation_note, evidence_reviewed_at, submitted_at, published_at, closed_at, created_at, updated_at";

/** The requester's own needs (RLS also enforces ownership). */
export async function listMyNeeds(userId: string): Promise<OwnNeed[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("needs")
    .select(OWN_COLUMNS)
    .eq("requester_id", userId)
    .order("updated_at", { ascending: false });
  return (data ?? []) as OwnNeed[];
}

export async function getMyNeed(userId: string, id: string): Promise<OwnNeed | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("needs").select(OWN_COLUMNS).eq("id", id).eq("requester_id", userId).maybeSingle();
  return (data as OwnNeed | null) ?? null;
}

export async function listEvidence(needId: string): Promise<EvidenceFile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("need_evidence")
    .select("id, need_id, file_name, mime_type, size_bytes, created_at")
    .eq("need_id", needId)
    .order("created_at");
  return (data ?? []) as EvidenceFile[];
}

export async function listMyEvidence(userId: string): Promise<(EvidenceFile & { need_title: string })[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("need_evidence")
    .select("id, need_id, file_name, mime_type, size_bytes, created_at, needs(title)")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => {
    const rel = r.needs as unknown as { title: string } | { title: string }[] | null;
    const title = Array.isArray(rel) ? rel[0]?.title : rel?.title;
    return { ...(r as unknown as EvidenceFile), need_title: title ?? "Need" };
  });
}

export async function listSavedNeeds(userId: string): Promise<PublicNeed[]> {
  const supabase = await createClient();
  const { data: saved } = await supabase
    .from("saved_needs")
    .select("need_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const ids = (saved ?? []).map((s) => s.need_id);
  if (!ids.length) return [];
  const { data } = await supabase.from("needs_public").select(PUBLIC_COLUMNS).in("id", ids);
  const byId = new Map(((data ?? []) as PublicNeed[]).map((n) => [n.id, n]));
  return ids.map((id) => byId.get(id)).filter((n): n is PublicNeed => Boolean(n));
}

export async function isNeedSaved(userId: string, needId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("saved_needs")
    .select("need_id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("need_id", needId);
  return (count ?? 0) > 0;
}

export function currencyFor(code: string, list: CurrencyInfo[]): CurrencyInfo {
  try {
    return getCurrency(code, list);
  } catch {
    return getCurrency("GBP");
  }
}
