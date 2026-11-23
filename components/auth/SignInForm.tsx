"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "@/app/(auth)/actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signInAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <Field id="email" label="Email address" error={e.email} required>
        <input className="field-input" type="email" autoComplete="email" inputMode="email" defaultValue={state.values?.email} required {...fieldAria("email", { error: e.email })} />
      </Field>
      <Field id="password" label="Password" error={e.password} required>
        <input className="field-input" type="password" autoComplete="current-password" required {...fieldAria("password", { error: e.password })} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-semibold text-navy-900 underline">Forgotten your password?</Link>
      </div>
      <SubmitButton variant="navy" size="lg" className="w-full" pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm text-muted">
        New to SolveANeed?{" "}
        <Link href="/get-started" className="font-semibold text-navy-900 underline">Create an account</Link>
      </p>
    </form>
  );
}
