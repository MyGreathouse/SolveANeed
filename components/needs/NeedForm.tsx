"use client";

import { useActionState, useState } from "react";
import { saveNeedAction } from "@/app/dashboard/requester/needs/actions";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import { CATEGORIES, SUPPORT_TYPES, UK_REGIONS } from "@/lib/domain/catalog";
import type { FormState } from "@/lib/utils/form";

export interface NeedFormDefaults {
  needId?: string;
  title: string;
  categorySlug: string;
  description: string;
  amount: string;
  currency: string;
  intendedUse: string;
  region: string;
  acceptedSupportTypes: string[];
  deadline: string;
  visibility: "public" | "members_only";
  showRequesterName: boolean;
}

export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  minorUnit: number;
  minLabel: string;
  maxLabel: string;
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-right text-xs text-muted" aria-live="polite">
      {value.length.toLocaleString("en-GB")} / {max.toLocaleString("en-GB")}
    </p>
  );
}

export function NeedForm({ defaults, currencies }: { defaults: NeedFormDefaults; currencies: CurrencyOption[] }) {
  const [state, action] = useActionState<FormState, FormData>(saveNeedAction, {});
  const e = state.errors ?? {};
  const v = state.values;
  const initial = {
    ...defaults,
    ...(v
      ? {
          ...v,
          acceptedSupportTypes: v.acceptedSupportTypes ? v.acceptedSupportTypes.split(",").filter(Boolean) : [],
          showRequesterName: v.showRequesterName === "on",
        }
      : {}),
  } as NeedFormDefaults;

  const [description, setDescription] = useState(initial.description);
  const [intendedUse, setIntendedUse] = useState(initial.intendedUse);
  const [currency, setCurrency] = useState(initial.currency);
  const cur = currencies.find((c) => c.code === currency) ?? currencies[0];
  const formKey = JSON.stringify(v ?? {});

  return (
    <form action={action} noValidate className="space-y-8" key={formKey}>
      {defaults.needId && <input type="hidden" name="needId" value={defaults.needId} />}
      {e.form && <Alert tone="danger" live title="Please check your need">{e.form}</Alert>}

      <section className="card space-y-6 p-6 md:p-8" aria-labelledby="sec-basics">
        <h2 id="sec-basics" className="text-lg font-bold">The basics</h2>
        <Field id="title" label="Title" hint="A short, clear summary — for example “Laptop for a web development course”." error={e.title} required>
          <input className="field-input" maxLength={120} defaultValue={initial.title} {...fieldAria("title", { hint: true, error: e.title })} />
        </Field>
        <Field id="categorySlug" label="Category" error={e.categorySlug} required>
          <select className="field-input" defaultValue={initial.categorySlug} {...fieldAria("categorySlug", { error: e.categorySlug })}>
            <option value="" disabled>Choose a category</option>
            {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </Field>
        <Field id="description" label="Detailed description" hint="Explain your situation and what difference this support would make. Please be factual — urgency or emotive wording does not improve your ranking." error={e.description} required>
          <textarea className="field-input min-h-40" maxLength={5000} value={description} onChange={(ev) => setDescription(ev.target.value)} {...fieldAria("description", { hint: true, error: e.description })} />
          <Counter value={description} max={5000} />
        </Field>
      </section>

      <section className="card space-y-6 p-6 md:p-8" aria-labelledby="sec-money">
        <h2 id="sec-money" className="text-lg font-bold">Amount and use</h2>
        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <Field id="currency" label="Currency" error={e.currency} required>
            <select className="field-input" value={currency} onChange={(ev) => setCurrency(ev.target.value)} {...fieldAria("currency", { error: e.currency })}>
              {currencies.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}
            </select>
          </Field>
          <Field
            id="amount"
            label="Requested amount"
            hint={cur ? `Between ${cur.minLabel} and ${cur.maxLabel}.${cur.minorUnit === 0 ? " Whole numbers only." : ""}` : undefined}
            error={e.amount}
            required
          >
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3.5 grid place-items-center font-semibold text-muted" aria-hidden="true">{cur?.symbol}</span>
              <input className="field-input pl-10" inputMode="decimal" autoComplete="off" defaultValue={initial.amount} placeholder="0" {...fieldAria("amount", { hint: true, error: e.amount })} />
            </div>
          </Field>
        </div>
        <p className="text-xs text-muted">The currency cannot be changed after you submit. Support for this need will only ever be recorded in this currency.</p>
        <Field id="intendedUse" label="How will the support be used?" hint="Be specific — for example the course provider, item or costs involved." error={e.intendedUse} required>
          <textarea className="field-input min-h-28" maxLength={2000} value={intendedUse} onChange={(ev) => setIntendedUse(ev.target.value)} {...fieldAria("intendedUse", { hint: true, error: e.intendedUse })} />
          <Counter value={intendedUse} max={2000} />
        </Field>
        <Field id="deadline" label="Relevant deadline" hint="For example a course start date. Leave blank if there isn't one." error={e.deadline}>
          <input type="date" className="field-input sm:max-w-xs" defaultValue={initial.deadline} {...fieldAria("deadline", { hint: true, error: e.deadline })} />
        </Field>
      </section>

      <section className="card space-y-6 p-6 md:p-8" aria-labelledby="sec-help">
        <h2 id="sec-help" className="text-lg font-bold">How people can help</h2>
        <fieldset aria-describedby={e.acceptedSupportTypes ? "acceptedSupportTypes-error" : "support-hint"}>
          <legend className="text-sm font-semibold text-navy-900">Accepted support types <span className="text-danger-700" aria-hidden="true">*</span></legend>
          <p id="support-hint" className="mt-1 text-sm text-muted">Choose every kind of help you&apos;re happy to receive. Gifts never require anything in return.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SUPPORT_TYPES.map((s) => (
              <label key={s.value} className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50">
                <input type="checkbox" name="acceptedSupportTypes" value={s.value} defaultChecked={initial.acceptedSupportTypes.includes(s.value)} className="mt-0.5 size-5 shrink-0 accent-navy-900" />
                <span><span className="block font-semibold text-navy-900">{s.label}</span><span className="text-sm text-muted">{s.description}</span></span>
              </label>
            ))}
          </div>
          {e.acceptedSupportTypes && <p id="acceptedSupportTypes-error" className="mt-2 text-sm font-medium text-danger-700" role="alert">{e.acceptedSupportTypes}</p>}
        </fieldset>
      </section>

      <section className="card space-y-6 p-6 md:p-8" aria-labelledby="sec-privacy">
        <h2 id="sec-privacy" className="text-lg font-bold">Location and privacy</h2>
        <Field id="region" label="General location" hint="Region only. Never include your address." error={e.region}>
          <select className="field-input" defaultValue={initial.region} {...fieldAria("region", { hint: true, error: e.region })}>
            <option value="">Prefer not to say</option>
            {UK_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-navy-900">Who can see this need once it&apos;s published?</legend>
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-3"><input type="radio" name="visibility" value="public" defaultChecked={initial.visibility === "public"} className="mt-1 size-5 accent-navy-900" /><span><strong>Everyone</strong> <span className="text-muted">— visible to visitors and search engines</span></span></label>
            <label className="flex items-start gap-3"><input type="radio" name="visibility" value="members_only" defaultChecked={initial.visibility === "members_only"} className="mt-1 size-5 accent-navy-900" /><span><strong>Signed-in members only</strong></span></label>
          </div>
        </fieldset>
        <label className="flex items-start gap-3">
          <input type="checkbox" name="showRequesterName" defaultChecked={initial.showRequesterName} className="mt-1 size-5 accent-navy-900" />
          <span>Show my display name on this need <span className="block text-sm text-muted">If unticked, supporters will see “a SolveANeed member”.</span></span>
        </label>
      </section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-col gap-3 rounded-2xl border border-line bg-white/95 p-4 backdrop-blur sm:flex-row sm:justify-end">
        <SubmitButton name="intent" value="save" variant="outline" size="lg" pendingLabel="Saving…">Save draft</SubmitButton>
        <SubmitButton name="intent" value="submit" variant="gold" size="lg" pendingLabel="Submitting…">Save and submit for review</SubmitButton>
      </div>
    </form>
  );
}
