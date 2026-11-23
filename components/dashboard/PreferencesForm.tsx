"use client";

import { useActionState } from "react";
import { savePreferencesAction } from "@/app/dashboard/supporter/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { CATEGORIES, SUPPORT_TYPES, UK_REGIONS } from "@/lib/domain/catalog";
import type { FormState } from "@/lib/utils/form";

export function PreferencesForm({
  defaults,
  currencies,
}: {
  defaults: { categories: string[]; supportTypes: string[]; regions: string[]; currency: string; maxAmount: string; openToPaidTasks: boolean };
  currencies: { code: string; name: string }[];
}) {
  const [state, action] = useActionState<FormState, FormData>(savePreferencesAction, {});
  const e = state.errors ?? {};
  const chip = "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-sm has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-gold-500";
  return (
    <form action={action} className="space-y-6">
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <fieldset className="card p-6">
        <legend className="sr-only">Categories</legend>
        <h2 className="font-bold">Categories you care about</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <label key={c.slug} className={chip}><input type="checkbox" name="categories" value={c.slug} defaultChecked={defaults.categories.includes(c.slug)} className="sr-only" />{c.label}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="card p-6">
        <legend className="sr-only">Support types</legend>
        <h2 className="font-bold">How you&apos;d like to help</h2>
        <p className="mt-1 text-sm text-muted">Needs that don&apos;t accept any of these are hidden from your matches.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {SUPPORT_TYPES.map((s) => (
            <label key={s.value} className={chip}><input type="checkbox" name="supportTypes" value={s.value} defaultChecked={defaults.supportTypes.includes(s.value)} className="sr-only" />{s.label}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="card p-6">
        <legend className="sr-only">Regions</legend>
        <h2 className="font-bold">Regions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {UK_REGIONS.map((r) => (
            <label key={r} className={chip}><input type="checkbox" name="regions" value={r} defaultChecked={defaults.regions.includes(r)} className="sr-only" />{r}</label>
          ))}
        </div>
      </fieldset>
      <div className="card grid gap-4 p-6 sm:grid-cols-[10rem_1fr]">
        <h2 className="font-bold sm:col-span-2">Budget (optional)</h2>
        <div>
          <label htmlFor="currency" className="block text-sm font-semibold">Currency</label>
          <select id="currency" name="currency" defaultValue={defaults.currency} className="field-input mt-1.5">
            <option value="">—</option>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          {e.currency && <p className="mt-1 text-sm text-danger-700" role="alert">{e.currency}</p>}
        </div>
        <div>
          <label htmlFor="maxAmount" className="block text-sm font-semibold">Typical maximum per need</label>
          <input id="maxAmount" name="maxAmount" inputMode="decimal" defaultValue={defaults.maxAmount} className="field-input mt-1.5" aria-invalid={e.maxAmount ? true : undefined} aria-describedby={e.maxAmount ? "maxAmount-error" : undefined} />
          {e.maxAmount && <p id="maxAmount-error" className="mt-1 text-sm text-danger-700" role="alert">{e.maxAmount}</p>}
        </div>
      </div>
      <label className="card flex items-start gap-3 p-6">
        <input type="checkbox" name="openToPaidTasks" defaultChecked={defaults.openToPaidTasks} className="mt-1 size-5 accent-navy-900" />
        <span><strong className="text-navy-900">I&apos;m open to receiving paid task offers</strong><span className="block text-sm text-muted">For requesters: allows supporters to offer you fairly paid remote work (EARN). You can change this at any time.</span></span>
      </label>
      <SubmitButton variant="navy" size="lg" pendingLabel="Saving…">Save preferences</SubmitButton>
    </form>
  );
}
