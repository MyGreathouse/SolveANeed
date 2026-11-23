import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { MfaChallengeForm } from "@/components/auth/MfaChallengeForm";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "Two-step verification", robots: { index: false } };

export default async function MfaPage({ searchParams }: PageProps<"/mfa">) {
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (viewer.aal === "aal2" || !viewer.mfaEnrolled) redirect(next);
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factors = (data?.totp ?? []).filter((f) => f.status === "verified").map((f) => ({ id: f.id, name: f.friendly_name ?? "Authenticator app" }));
  return (
    <>
      <p className="eyebrow">Security check</p>
      <h1 className="mt-2 text-3xl font-extrabold">Two-step verification</h1>
      <p className="mt-2 text-muted">Your account is protected with an authenticator app. Enter a code to continue.</p>
      <div className="mt-7"><MfaChallengeForm next={next} factors={factors} /></div>
      <div className="mt-8 rounded-2xl bg-navy-50 p-4 text-sm text-charcoal">
        <p className="font-semibold text-navy-900">Lost your device?</p>
        <p className="mt-1">Use your backup authenticator app if you set one up. Otherwise contact a SolveANeed administrator — they will verify your identity before resetting two-step verification, and the reset is recorded.</p>
      </div>
      <div className="mt-4 text-center"><SignOutButton className="min-h-11 text-sm font-semibold text-navy-900 underline" label="Sign out instead" /></div>
    </>
  );
}
