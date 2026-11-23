import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "./session";

/** Reads the database setting; defaults to REQUIRED if it cannot be read. */
export async function staffMfaRequired(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("value").eq("key", "require_staff_mfa").maybeSingle();
  if (error || !data) return true;
  return data.value !== false;
}

/**
 * Staff guard. Non-staff get a 404. Staff must have completed MFA (aal2) in
 * this session; those without a factor are sent to enrol, those with one are
 * sent to the challenge. The database enforces the same rule independently
 * (has_role() ignores staff roles below aal2).
 */
export async function requireStaff(opts: { adminOnly?: boolean; next?: string } = {}) {
  const viewer = await requireRole(opts.adminOnly ? ["admin"] : ["moderator", "admin"], { hide: true, next: opts.next ?? "/admin" });
  if ((await staffMfaRequired()) && viewer.aal !== "aal2") {
    redirect(viewer.mfaEnrolled ? `/mfa?next=${encodeURIComponent(opts.next ?? "/admin")}` : "/dashboard/settings?mfa=required#mfa");
  }
  return { viewer, isAdmin: viewer.roles.includes("admin") };
}
