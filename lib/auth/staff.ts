import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "./session";

/**
 * Staff guard with step-up security. When REQUIRE_STAFF_MFA=true, staff must
 * have completed multi-factor authentication in this session (AAL2).
 */
export async function requireStaff(opts: { adminOnly?: boolean } = {}) {
  const viewer = await requireRole(opts.adminOnly ? ["admin"] : ["moderator", "admin"], { hide: true });
  const mfaRequired = process.env.REQUIRE_STAFF_MFA === "true";
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const aal = (data?.claims as { aal?: string } | undefined)?.aal;
  return { viewer, mfaRequired, mfaSatisfied: aal === "aal2", isAdmin: viewer.roles.includes("admin") };
}
