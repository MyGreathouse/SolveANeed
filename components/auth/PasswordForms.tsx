"use client";

import { useActionState } from "react";
import { forgotPasswordAction, resetPasswordAction } from "@/app/(auth)/actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, {});
  const e = state.errors ?? {};
  if (state.ok) return <Alert tone="success" live title="Check your email">{state.message}</Alert>;
  return (
    <form action={action} noValidate className="space-y-5">
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <Field id="email" label="Email address" error={e.email} required>
        <input className="field-input" type="email" autoComplete="email" required {...fieldAria("email", { error: e.email })} />
      </Field>
      <SubmitButton variant="navy" size="lg" className="w-full" pendingLabel="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} noValidate className="space-y-5">
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <Field id="password" label="New password" hint="At least 12 characters, including a letter and a number." error={e.password} required>
        <input className="field-input" type="password" autoComplete="new-password" required {...fieldAria("password", { hint: true, error: e.password })} />
      </Field>
      <Field id="confirm" label="Confirm new password" error={e.confirm} required>
        <input className="field-input" type="password" autoComplete="new-password" required {...fieldAria("confirm", { error: e.confirm })} />
      </Field>
      <SubmitButton variant="navy" size="lg" className="w-full" pendingLabel="Updating…">Update password</SubmitButton>
    </form>
  );
}
