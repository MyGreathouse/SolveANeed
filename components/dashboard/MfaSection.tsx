"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmTotpEnrolment, startTotpEnrolment, type EnrolStart } from "@/app/dashboard/settings/mfa-actions";
import { Button } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { Field, fieldAria } from "@/components/ui/Field";
import type { FormState } from "@/lib/utils/form";

/** Authenticator-app enrolment: start → scan QR (or type secret) → confirm with a code. */
export function MfaEnrol({ isFirst }: { isFirst: boolean }) {
  const [start, setStart] = useState<EnrolStart | null>(null);
  const [pending, startTransition] = useTransition();
  const [state, action] = useActionState<FormState, FormData>(confirmTotpEnrolment, {});

  if (state.ok) return <Alert tone="success" live>{state.message} {isFirst && "We strongly recommend adding a second device as a backup."}</Alert>;

  if (!start || "error" in start) {
    return (
      <div className="space-y-3">
        {start && "error" in start && <Alert tone="danger" live>{start.error}</Alert>}
        <Button variant="navy" disabled={pending} onClick={() => startTransition(async () => setStart(await startTotpEnrolment()))}>
          {pending ? "Preparing…" : isFirst ? "Set up an authenticator app" : "Add a backup authenticator app"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 rounded-2xl border border-line p-5 md:grid-cols-[12rem_1fr]">
      {/* eslint-disable-next-line @next/next/no-img-element -- QR code is an inline SVG data URL from Supabase Auth */}
      <img src={start.qr} alt="QR code to add SolveANeed to your authenticator app" className="size-48 rounded-xl border border-line bg-white p-2" />
      <div className="space-y-4">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          <li>Open an authenticator app (for example Google Authenticator, Microsoft Authenticator or 1Password).</li>
          <li>Scan the QR code, or enter this key manually:</li>
        </ol>
        <p className="break-all rounded-xl bg-navy-50 p-3 font-mono text-sm" data-testid="totp-secret">{start.secret}</p>
        <form action={action} className="space-y-3" noValidate>
          <input type="hidden" name="factorId" value={start.factorId} />
          <Field id="code" label="Enter the 6-digit code to confirm" error={state.errors?.code} required>
            <input className="field-input max-w-[12rem] font-mono text-lg tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} {...fieldAria("code", { error: state.errors?.code })} />
          </Field>
          <SubmitButton variant="teal" pendingLabel="Checking…">Confirm and turn on</SubmitButton>
        </form>
      </div>
    </div>
  );
}
