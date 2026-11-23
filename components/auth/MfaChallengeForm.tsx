"use client";

import { useActionState } from "react";
import { verifyMfaChallengeAction } from "@/app/dashboard/settings/mfa-actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export function MfaChallengeForm({ next, factors }: { next: string; factors: { id: string; name: string }[] }) {
  const [state, action] = useActionState<FormState, FormData>(verifyMfaChallengeAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      {factors.length > 1 && (
        <Field id="factorId" label="Authenticator app" required>
          <select className="field-input" {...fieldAria("factorId", {})}>
            {factors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      )}
      <Field id="code" label="6-digit code" hint="Open your authenticator app and enter the current code for SolveANeed." error={e.code} required>
        <input
          className="field-input text-center font-mono text-2xl tracking-[0.4em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          autoFocus
          {...fieldAria("code", { hint: true, error: e.code })}
        />
      </Field>
      <SubmitButton variant="navy" size="lg" className="w-full" pendingLabel="Verifying…">Verify</SubmitButton>
    </form>
  );
}
