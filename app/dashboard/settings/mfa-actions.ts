"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer, requireViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirects";
import { allowAnon } from "@/lib/security/rate-limit";
import { str, type FormState } from "@/lib/utils/form";

const codeSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app");

export type EnrolStart = { factorId: string; qr: string; secret: string } | { error: string };

/** Begins TOTP enrolment. Stale, unverified factors are removed first. */
export async function startTotpEnrolment(): Promise<EnrolStart> {
  await requireViewer("/dashboard/settings");
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const all = factors?.all ?? [];
  for (const f of all.filter((f) => f.status !== "verified" && f.factor_type === "totp")) {
    await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const verifiedCount = all.filter((f) => f.status === "verified").length;
  if (verifiedCount >= 5) return { error: "You already have the maximum number of authenticator apps." };
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${verifiedCount + 1} (${new Date().toISOString().slice(0, 10)})`,
    issuer: "SolveANeed",
  });
  if (error || !data) return { error: "We couldn't start set-up. Please try again." };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrolment(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer("/dashboard/settings");
  const code = codeSchema.safeParse(str(fd, "code"));
  if (!code.success) return { errors: { code: code.error.issues[0].message } };
  if (!(await allowAnon([{ action: "mfa_verify_user", subject: viewer.id }]))) {
    return { errors: { code: "Too many attempts. Please wait 15 minutes and try again." } };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: str(fd, "factorId"), code: code.data });
  if (error) return { errors: { code: "That code didn't match. Check your device's clock and try a new code." } };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Authenticator app added. This session now has two-step verification." };
}

export async function removeFactorAction(fd: FormData): Promise<void> {
  await requireViewer("/dashboard/settings");
  const supabase = await createClient();
  // Supabase requires an aal2 session to remove a verified factor.
  await supabase.auth.mfa.unenroll({ factorId: str(fd, "factorId") });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?notice=mfa-removed#mfa");
}

/** Sign-in challenge: verifies a code against the member's first verified TOTP factor. */
export async function verifyMfaChallengeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) redirect("/sign-in");
  const code = codeSchema.safeParse(str(fd, "code"));
  if (!code.success) return { errors: { code: code.error.issues[0].message } };
  if (!(await allowAnon([{ action: "mfa_verify_user", subject: viewer.id }]))) {
    return { errors: { code: "Too many attempts. Please wait 15 minutes and try again." } };
  }
  const supabase = await createClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factorId = str(fd, "factorId") || factors?.totp?.find((f) => f.status === "verified")?.id;
  if (!factorId || !factors?.totp?.some((f) => f.id === factorId && f.status === "verified")) {
    return { errors: { form: "No authenticator app is set up for this account." } };
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { errors: { code: "That code didn't match. Try the newest code from your app." } };
  redirect(safeNextPath(str(fd, "next")));
}
