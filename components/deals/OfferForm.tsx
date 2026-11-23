"use client";

import { useActionState, useId, useState } from "react";
import { counterOfferAction, createOfferAction } from "@/app/dashboard/deals/actions";
import { SUPPORT_TYPES, type SupportType } from "@/lib/domain/catalog";
import { Field, fieldAria } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export interface OfferFormDefaults {
  amount?: string;
  terms?: Record<string, unknown>;
  milestoneAmounts?: string[];
}

type Props = {
  mode: "create" | "counter";
  allowedTypes: SupportType[];
  currency: { code: string; symbol: string };
  needId?: string;
  offerId?: string;
  version?: number;
  fixedType?: SupportType;
  paidTasksOpen?: boolean;
  defaults?: OfferFormDefaults;
};

const s = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

export function OfferForm(props: Props) {
  const { mode, allowedTypes, currency, defaults } = props;
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createOfferAction : counterOfferAction, {});
  const v = state.values;
  const dv = (name: string, fallback: string) => (v ? (v[name] ?? "") : fallback);
  const [type, setType] = useState<SupportType>(props.fixedType ?? allowedTypes[0]);
  const t = defaults?.terms ?? {};
  const initialMilestones = Array.isArray(t.milestones) ? (t.milestones as Record<string, unknown>[]) : [];
  const [msCount, setMsCount] = useState(Math.max(1, initialMilestones.length || 2));
  const uid = useId();
  const e = state.errors ?? {};
  const f = (name: string) => `${uid}-${name}`;
  const err = (k: string) => e[k];

  const options = SUPPORT_TYPES.filter((o) => allowedTypes.includes(o.value));

  return (
    <form action={action} className="space-y-6" noValidate key={JSON.stringify(v ?? {})}>
      {props.needId && <input type="hidden" name="needId" value={props.needId} />}
      {props.offerId && <input type="hidden" name="offerId" value={props.offerId} />}
      {props.version && <input type="hidden" name="version" value={props.version} />}
      <input type="hidden" name="currency" value={currency.code} />
      <input type="hidden" name="type" value={type} />
      {e.form && <Alert tone="danger" live title="Not sent">{e.form}</Alert>}

      {!props.fixedType && (
        <fieldset>
          <legend className="text-sm font-semibold text-navy-900">How would you like to help?</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {options.map((o) => {
              const disabled = o.value === "paid_task" && !props.paidTasksOpen;
              return (
                <label
                  key={o.value}
                  className={`flex cursor-pointer gap-3 rounded-2xl border p-4 has-[:checked]:border-navy-900 has-[:checked]:bg-navy-50 ${disabled ? "cursor-not-allowed opacity-60" : "border-line bg-white"}`}
                >
                  <input
                    type="radio"
                    name="typeChoice"
                    value={o.value}
                    checked={type === o.value}
                    onChange={() => setType(o.value)}
                    disabled={disabled}
                    className="mt-1 size-4 accent-navy-900"
                  />
                  <span>
                    <span className="block font-bold text-navy-900">{o.label}</span>
                    <span className="text-sm text-muted">
                      {disabled ? "This member is not accepting paid tasks." : o.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {(type === "gift" || type === "paid_task") && (
        <Field id={f("amount")} label={type === "paid_task" ? `Task price (${currency.code})` : `Amount (${currency.code})`} required error={err("amount")}
          hint={type === "paid_task" ? "The full price for the agreed work. SolveANeed's fee is shown before any payment, when payments launch." : undefined}>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">{currency.symbol}</span>
            <input {...fieldAria(f("amount"), { hint: type === "paid_task", error: err("amount") })} name="amount" inputMode="decimal" className="field-input pl-9" defaultValue={dv("amount", defaults?.amount ?? "")} required />
          </div>
        </Field>
      )}

      {type === "paid_task" && (
        <>
          <Field id={f("title")} label="Task title" required error={err("title")}>
            <input {...fieldAria(f("title"), { error: err("title") })} name="title" className="field-input" maxLength={120} defaultValue={dv("title", s(t.title))} />
          </Field>
          <Field id={f("description")} label="What needs doing" required error={err("description")}>
            <textarea {...fieldAria(f("description"), { error: err("description") })} name="description" rows={4} className="field-input" maxLength={4000} defaultValue={dv("description", s(t.description))} />
          </Field>
          <Field id={f("deliverables")} label="Deliverables" required error={err("deliverables") ?? err("deliverables.0")} hint="One per line — exactly what will be handed over.">
            <textarea {...fieldAria(f("deliverables"), { hint: true, error: err("deliverables") })} name="deliverables" rows={3} className="field-input"
              defaultValue={dv("deliverables", Array.isArray(t.deliverables) ? (t.deliverables as string[]).join("\n") : "")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={f("deadline")} label="Deadline" required error={err("deadline")}>
              <input {...fieldAria(f("deadline"), { error: err("deadline") })} name="deadline" type="date" min={tomorrow()} className="field-input" defaultValue={dv("deadline", s(t.deadline))} />
            </Field>
            <Field id={f("max_revisions")} label="Revisions included" required error={err("max_revisions")}>
              <select {...fieldAria(f("max_revisions"), { error: err("max_revisions") })} name="max_revisions" className="field-input" defaultValue={dv("max_revisions", s(t.max_revisions) || "1")}>
                {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>
          <Field id={f("acceptance_criteria")} label="Acceptance criteria" required error={err("acceptance_criteria")} hint="Objective checks the work will be reviewed against.">
            <textarea {...fieldAria(f("acceptance_criteria"), { hint: true, error: err("acceptance_criteria") })} name="acceptance_criteria" rows={3} className="field-input" defaultValue={dv("acceptance_criteria", s(t.acceptance_criteria))} />
          </Field>
          <Field id={f("cancellation_policy")} label="Cancellation policy" error={err("cancellation_policy")} hint="Leave blank for the standard policy: free before work starts; afterwards, pay only for work delivered and accepted.">
            <textarea {...fieldAria(f("cancellation_policy"), { hint: true, error: err("cancellation_policy") })} name="cancellation_policy" rows={2} className="field-input" defaultValue={dv("cancellation_policy", s(t.cancellation_policy))} />
          </Field>
          <label className="flex gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
            <input type="checkbox" name="remote_only" defaultChecked={v ? v.remote_only === "on" : t.remote_only === true} className="mt-0.5 size-4 accent-navy-900" aria-describedby={err("remote_only") ? f("remote-err") : undefined} />
            <span>This task is done <strong>remotely</strong>. No home visits or in-person meetings.</span>
          </label>
          {err("remote_only") && <p id={f("remote-err")} className="text-sm font-medium text-danger-700" role="alert">{err("remote_only")}</p>}
        </>
      )}

      {type === "milestone" && (
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-navy-900">Milestones</legend>
          <p className="text-sm text-muted">Each milestone needs objective criteria and the evidence that will show it was met. The total is the sum of the milestones.</p>
          {err("milestones") && <Alert tone="danger" live>{err("milestones")}</Alert>}
          {Array.from({ length: msCount }, (_, i) => {
            const m = initialMilestones[i] ?? {};
            const me = (k: string) => err(`milestones.${i}.${k}`);
            return (
              <div key={i} className="space-y-3 rounded-2xl border border-line bg-white p-4">
                <p className="text-sm font-bold text-navy-900">Milestone {i + 1}</p>
                <div className="grid gap-3 sm:grid-cols-[1fr_9rem_10rem]">
                  <Field id={f(`m${i}_title`)} label="Title" required error={me("title")}>
                    <input {...fieldAria(f(`m${i}_title`), { error: me("title") })} name={`m${i}_title`} className="field-input" defaultValue={dv(`m${i}_title`, s(m.title))} />
                  </Field>
                  <Field id={f(`m${i}_amount`)} label={`Amount (${currency.code})`} required error={me("amount_minor")}>
                    <input {...fieldAria(f(`m${i}_amount`), { error: me("amount_minor") })} name={`m${i}_amount`} inputMode="decimal" className="field-input" defaultValue={dv(`m${i}_amount`, defaults?.milestoneAmounts?.[i] ?? "")} />
                  </Field>
                  <Field id={f(`m${i}_due`)} label="Due date" required error={me("due_date")}>
                    <input {...fieldAria(f(`m${i}_due`), { error: me("due_date") })} name={`m${i}_due`} type="date" min={tomorrow()} className="field-input" defaultValue={dv(`m${i}_due`, s(m.due_date))} />
                  </Field>
                </div>
                <Field id={f(`m${i}_criteria`)} label="Criteria" required error={me("criteria")}>
                  <input {...fieldAria(f(`m${i}_criteria`), { error: me("criteria") })} name={`m${i}_criteria`} className="field-input" defaultValue={dv(`m${i}_criteria`, s(m.criteria))} />
                </Field>
                <Field id={f(`m${i}_evidence`)} label="Evidence required" required error={me("evidence")}>
                  <input {...fieldAria(f(`m${i}_evidence`), { error: me("evidence") })} name={`m${i}_evidence`} className="field-input" defaultValue={dv(`m${i}_evidence`, s(m.evidence))} />
                </Field>
              </div>
            );
          })}
          <div className="flex gap-3">
            {msCount < 10 && <button type="button" onClick={() => setMsCount((n) => n + 1)} className="min-h-11 rounded-full border border-navy-900/25 bg-white px-4 text-sm font-semibold text-navy-900">Add a milestone</button>}
            {msCount > 1 && <button type="button" onClick={() => setMsCount((n) => n - 1)} className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted underline">Remove the last one</button>}
          </div>
        </fieldset>
      )}

      {type === "direct_support" && (
        <>
          <Field id={f("kind")} label="Kind of help" required error={err("kind")}>
            <select {...fieldAria(f("kind"), { error: err("kind") })} name="kind" className="field-input" defaultValue={dv("kind", s(t.kind) || "mentoring")}>
              <option value="mentoring">Mentoring</option>
              <option value="expertise">Expertise (advice or a professional skill)</option>
              <option value="time">My time (practical help)</option>
            </select>
          </Field>
          <Field id={f("description")} label="What you will do" required error={err("description")}>
            <textarea {...fieldAria(f("description"), { error: err("description") })} name="description" rows={4} className="field-input" defaultValue={dv("description", s(t.description))} />
          </Field>
          <Field id={f("schedule")} label="When" error={err("schedule")} hint="For example: two one-hour video calls in March.">
            <input {...fieldAria(f("schedule"), { hint: true, error: err("schedule") })} name="schedule" className="field-input" defaultValue={dv("schedule", s(t.schedule))} />
          </Field>
          <label className="flex gap-3 rounded-2xl border border-line bg-white p-4 text-sm">
            <input type="checkbox" name="online_or_public_only" defaultChecked={v ? v.online_or_public_only === "on" : t.online_or_public_only === true} className="mt-0.5 size-4 accent-navy-900" />
            <span>We will meet <strong>online or in a public place</strong> only, and keep contact on SolveANeed.</span>
          </label>
          {err("online_or_public_only") && <p className="text-sm font-medium text-danger-700" role="alert">{err("online_or_public_only")}</p>}
          <p className="text-sm text-muted">Equipment and course purchases through approved suppliers will arrive with payments.</p>
        </>
      )}

      <Field id={f("message")} label="Message" error={err("message")} hint="Don't include bank details, phone numbers or other contact details — keep everything on SolveANeed.">
        <textarea {...fieldAria(f("message"), { hint: true, error: err("message") })} name="message" rows={3} className="field-input" maxLength={2000} defaultValue={dv("message", s(t.message))} />
      </Field>

      <Alert tone="info" title="No money moves yet">
        Sending an offer does not take a payment. If it is accepted, it becomes an agreement marked “Agreed — not funded”. Payments are not yet available on SolveANeed.
      </Alert>
      <SubmitButton variant="gold" size="lg" pendingLabel="Sending…">{mode === "create" ? "Send offer" : "Send counter-offer"}</SubmitButton>
    </form>
  );
}
