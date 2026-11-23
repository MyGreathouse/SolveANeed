"use client";

import { useActionState, useId } from "react";
import { reportAction } from "@/app/needs/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

const reasons = [
  ["fraud_or_scam", "Fraud or scam"],
  ["misleading", "Misleading or inaccurate"],
  ["duplicate", "Duplicate of another need"],
  ["prohibited_request", "Prohibited request"],
  ["inappropriate", "Inappropriate content"],
  ["harassment", "Harassment or abuse"],
  ["other", "Something else"],
] as const;

export function ReportForm({ targetType, targetId, label = "Report a concern" }: { targetType: "need" | "profile" | "message" | "offer"; targetId: string; label?: string }) {
  const [state, action] = useActionState<FormState, FormData>(reportAction, {});
  const id = useId();
  if (state.ok) return <Alert tone="success" live>{state.message}</Alert>;
  return (
    <details className="group rounded-2xl border border-line bg-white">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-navy-900">
        {label} <span aria-hidden="true" className="transition-transform group-open:rotate-180">▾</span>
      </summary>
      <form action={action} className="space-y-4 border-t border-line p-4">
        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        {state.errors?.form && <Alert tone="danger" live>{state.errors.form}</Alert>}
        <div>
          <label htmlFor={`${id}-reason`} className="block text-sm font-semibold">Reason</label>
          <select id={`${id}-reason`} name="reason" required className="field-input mt-1.5" defaultValue="">
            <option value="" disabled>Choose a reason</option>
            {reasons.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          {state.errors?.reason && <p className="mt-1 text-sm text-danger-700" role="alert">Please choose a reason.</p>}
        </div>
        <div>
          <label htmlFor={`${id}-details`} className="block text-sm font-semibold">Details <span className="font-normal text-muted">(optional)</span></label>
          <textarea id={`${id}-details`} name="details" rows={3} maxLength={2000} className="field-input mt-1.5" />
        </div>
        <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">Send report</SubmitButton>
      </form>
    </details>
  );
}
