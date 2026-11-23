"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SITE_URL, isSupabaseConfigured } from "@/lib/supabase/env";
import { emailOnlySchema, newPasswordSchema, signInSchema, signUpSchema } from "@/lib/domain/validation";
import { safeNextPath } from "@/lib/auth/redirects";
import { str, zodErrors, type FormState } from "@/lib/utils/form";

const NOT_CONFIGURED: FormState = {
  errors: { form: "Accounts are not available yet: the database has not been connected. Please try again later." },
};

export async function signUpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = {
    displayName: str(fd, "displayName"),
    email: str(fd, "email").trim().toLowerCase(),
    password: str(fd, "password"),
    intent: str(fd, "intent") || "both",
    ageConfirmed: str(fd, "ageConfirmed"),
    termsAccepted: str(fd, "termsAccepted"),
  };
  const values = { displayName: raw.displayName, email: raw.email, intent: raw.intent };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values };

  const next = safeNextPath(str(fd, "next"), parsed.data.intent === "need" ? "/dashboard/requester/needs/new" : "/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${SITE_URL}${next}`,
      data: {
        display_name: parsed.data.displayName,
        intent: parsed.data.intent,
        age_confirmed: "true",
        terms_accepted: "true",
      },
    },
  });
  if (error) {
    const weak = error.code === "weak_password";
    const limited = error.status === 429;
    return {
      errors: {
        [weak ? "password" : "form"]: weak
          ? "That password is too common or weak. Please choose another."
          : limited
            ? "Too many attempts. Please wait a few minutes and try again."
            : "We couldn't create your account. Please check your details and try again.",
      },
      values,
    };
  }
  // Same response whether or not the email already exists (prevents account enumeration).
  redirect(`/check-email?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const raw = { email: str(fd, "email").trim().toLowerCase(), password: str(fd, "password") };
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: { email: raw.email } };
  if (!isSupabaseConfigured()) return { ...NOT_CONFIGURED, values: { email: raw.email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg =
      error.code === "email_not_confirmed"
        ? "Please verify your email address first. Check your inbox for the link we sent."
        : error.status === 429
          ? "Too many sign-in attempts. Please wait a few minutes and try again."
          : "The email or password is incorrect.";
    return { errors: { form: msg }, values: { email: raw.email } };
  }
  redirect(safeNextPath(str(fd, "next")));
}

export async function forgotPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, "email").trim().toLowerCase() });
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${SITE_URL}/reset-password`,
  });
  // Always the same message, whether or not an account exists.
  return { ok: true, message: "If an account exists for that email, we've sent a link to reset your password. It expires in one hour." };
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: str(fd, "password"), confirm: str(fd, "confirm") });
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  if (!isSupabaseConfigured()) return NOT_CONFIGURED;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) {
    return { errors: { form: "Your reset link has expired. Please request a new one." } };
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return { errors: { password: error.code === "same_password" ? "Choose a password you haven't used before." : "We couldn't update your password. Please try again." } };
  }
  // Revoke other sessions after a password change.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard/settings?notice=password-updated");
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/");
}
