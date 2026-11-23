import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AppRole, Viewer } from "./types";

/**
 * Data Access Layer: the ONLY place the app resolves who the current user is.
 * Uses getClaims() (verifies the JWT) — never trusts getSession() alone.
 * Cached per request.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return null;

  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, account_status, preferred_currency, identity_verified_at")
      .eq("id", claims.sub)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", claims.sub),
  ]);
  if (!profile) return null;

  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? null,
    emailVerified: Boolean((claims as Record<string, unknown>).email_verified ?? (claims.user_metadata as Record<string, unknown> | undefined)?.email_verified ?? true),
    displayName: profile.display_name,
    accountStatus: profile.account_status,
    roles: (roles ?? []).map((r) => r.role as AppRole),
    preferredCurrency: profile.preferred_currency,
    identityVerified: profile.identity_verified_at != null,
  };
});

/** Requires a signed-in, ACTIVE account. */
export async function requireViewer(next?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (viewer.accountStatus !== "active") redirect("/account/status");
  return viewer;
}

/** Requires one of the given roles. Staff areas 404 rather than revealing they exist. */
export async function requireRole(roles: AppRole[], opts: { next?: string; hide?: boolean } = {}): Promise<Viewer> {
  const viewer = await requireViewer(opts.next);
  if (!roles.some((r) => viewer.roles.includes(r))) {
    if (opts.hide) notFound();
    redirect(`/dashboard/settings?missingRole=${roles[0]}`);
  }
  return viewer;
}
