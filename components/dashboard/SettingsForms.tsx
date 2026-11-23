"use client";

import { useActionState } from "react";
import { requestDeletionAction, updateNotificationsAction, updateProfileAction } from "@/app/dashboard/settings/actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { UK_REGIONS } from "@/lib/domain/catalog";
import type { FormState } from "@/lib/utils/form";

export function ProfileForm({
  defaults,
  currencies,
}: {
  defaults: { displayName: string; bio: string; region: string; preferredCurrency: string; showRegion: boolean };
  currencies: { code: string; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(updateProfileAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-5">
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      {state.ok && <Alert tone="success" live>{state.message}</Alert>}
      <Field id="displayName" label="Display name" error={e.displayName} required>
        <input className="field-input" maxLength={60} defaultValue={defaults.displayName} autoComplete="nickname" {...fieldAria("displayName", { error: e.displayName })} />
      </Field>
      <Field id="bio" label="About you" hint="A sentence or two. Don't include contact details." error={e.bio}>
        <textarea className="field-input min-h-24" maxLength={1000} defaultValue={defaults.bio} {...fieldAria("bio", { hint: true, error: e.bio })} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="region" label="Region" error={e.region}>
          <select className="field-input" defaultValue={defaults.region} {...fieldAria("region", { error: e.region })}>
            <option value="">Prefer not to say</option>
            {UK_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field id="preferredCurrency" label="Preferred currency" error={e.preferredCurrency} required>
          <select className="field-input" defaultValue={defaults.preferredCurrency} {...fieldAria("preferredCurrency", { error: e.preferredCurrency })}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-3">
        <input type="checkbox" name="showRegion" defaultChecked={defaults.showRegion} className="mt-1 size-5 accent-navy-900" />
        <span>Show my region on my public profile</span>
      </label>
      <SubmitButton variant="navy" pendingLabel="Saving…">Save profile</SubmitButton>
    </form>
  );
}

export function NotificationsForm({ defaults }: { defaults: Record<"notifyOffers" | "notifyMessages" | "notifyUpdates" | "notifyMarketing", boolean> }) {
  const [state, action] = useActionState<FormState, FormData>(updateNotificationsAction, {});
  const rows = [
    ["notifyOffers", "Offers and agreements", "New offers, acceptances, deadlines and reviews."],
    ["notifyMessages", "Messages", "When someone sends you a message."],
    ["notifyUpdates", "Need and account updates", "Moderation decisions and security notices. Security emails are always sent."],
    ["notifyMarketing", "News from SolveANeed", "Occasional product news. Off unless you turn it on."],
  ] as const;
  return (
    <form action={action} className="space-y-4">
      {state.errors?.form && <Alert tone="danger" live>{state.errors.form}</Alert>}
      {state.ok && <Alert tone="success" live>{state.message}</Alert>}
      <fieldset className="space-y-3">
        <legend className="sr-only">Email notifications</legend>
        {rows.map(([name, title, hint]) => (
          <label key={name} className="flex items-start gap-3 rounded-2xl border border-line p-4">
            <input type="checkbox" name={name} defaultChecked={defaults[name]} className="mt-1 size-5 accent-navy-900" />
            <span><span className="block font-semibold text-navy-900">{title}</span><span className="text-sm text-muted">{hint}</span></span>
          </label>
        ))}
      </fieldset>
      <SubmitButton variant="navy" pendingLabel="Saving…">Save notification settings</SubmitButton>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action] = useActionState<FormState, FormData>(requestDeletionAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <Field id="deleteConfirm" label={<>Type <strong>DELETE</strong> to confirm</>} error={e.deleteConfirm} required>
        <input className="field-input sm:max-w-xs" autoComplete="off" {...fieldAria("deleteConfirm", { error: e.deleteConfirm })} />
      </Field>
      <SubmitButton variant="danger" pendingLabel="Processing…">Delete my account</SubmitButton>
    </form>
  );
}
