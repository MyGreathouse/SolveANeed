"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/app/(auth)/actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

const intents = [
  { value: "need", title: "I need help", body: "Post a need and receive offers of support." },
  { value: "help", title: "I want to help", body: "Give, offer paid tasks, fund milestones or solve directly." },
  { value: "both", title: "Both", body: "Use one account on both sides." },
] as const;

export function SignUpForm({ defaultIntent, next }: { defaultIntent: "need" | "help" | "both"; next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signUpAction, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const intent = v.intent ?? defaultIntent;

  return (
    <form action={action} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">How will you use SolveANeed?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {intents.map((opt) => (
            <label
              key={opt.value}
              className="relative flex cursor-pointer flex-col rounded-2xl border border-line bg-white p-3.5 text-sm has-[:checked]:border-navy-900 has-[:checked]:ring-2 has-[:checked]:ring-gold-500 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-500"
            >
              <input type="radio" name="intent" value={opt.value} defaultChecked={intent === opt.value} className="sr-only" />
              <span className="font-semibold text-navy-900">{opt.title}</span>
              <span className="mt-1 text-muted">{opt.body}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">You can switch sides at any time from your settings.</p>
      </fieldset>

      <Field id="displayName" label="Display name" hint="Shown to others. You can use your first name." error={e.displayName} required>
        <input className="field-input" autoComplete="given-name" defaultValue={v.displayName} required maxLength={60} {...fieldAria("displayName", { hint: true, error: e.displayName })} />
      </Field>
      <Field id="email" label="Email address" error={e.email} required>
        <input className="field-input" type="email" autoComplete="email" inputMode="email" defaultValue={v.email} required {...fieldAria("email", { error: e.email })} />
      </Field>
      <Field id="password" label="Password" hint="At least 12 characters, including a letter and a number." error={e.password} required>
        <input className="field-input" type="password" autoComplete="new-password" required minLength={12} {...fieldAria("password", { hint: true, error: e.password })} />
      </Field>

      <div className="space-y-3 rounded-2xl bg-navy-50 p-4">
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="ageConfirmed" className="mt-0.5 size-5 shrink-0 accent-navy-900" aria-invalid={e.ageConfirmed ? true : undefined} aria-describedby={e.ageConfirmed ? "ageConfirmed-error" : undefined} />
          <span>I confirm that I am <strong>18 years of age or older</strong>.</span>
        </label>
        {e.ageConfirmed && <p id="ageConfirmed-error" className="text-sm font-medium text-danger-700" role="alert">{e.ageConfirmed}</p>}
        <label className="flex gap-3 text-sm">
          <input type="checkbox" name="termsAccepted" className="mt-0.5 size-5 shrink-0 accent-navy-900" aria-invalid={e.termsAccepted ? true : undefined} aria-describedby={e.termsAccepted ? "termsAccepted-error" : undefined} />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="font-semibold text-navy-900 underline" target="_blank">Terms of Use</Link>{" "}
            and have read the{" "}
            <Link href="/legal/privacy" className="font-semibold text-navy-900 underline" target="_blank">Privacy Notice</Link>.
          </span>
        </label>
        {e.termsAccepted && <p id="termsAccepted-error" className="text-sm font-medium text-danger-700" role="alert">{e.termsAccepted}</p>}
      </div>

      <SubmitButton variant="gold" size="lg" className="w-full" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={`/sign-in${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-navy-900 underline">Sign in</Link>
      </p>
    </form>
  );
}
