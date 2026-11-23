"use client";

import { useActionState, useId } from "react";
import { cancelAgreementAction, openDisputeAction, reviewWorkAction, submitWorkAction } from "@/app/dashboard/deals/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

function Err({ id, msg }: { id: string; msg?: string }) {
  return msg ? <p id={id} className="text-sm font-medium text-danger-700" role="alert">{msg}</p> : null;
}

export function SubmitWorkForm({ agreementId, conversationId }: { agreementId: string; conversationId: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitWorkAction, {});
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <input type="hidden" name="conversationId" value={conversationId} />
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <label htmlFor={`${id}-d`} className="block text-sm font-semibold text-navy-900">What are you submitting?</label>
      <textarea id={`${id}-d`} name="description" rows={4} maxLength={4000} className="field-input" required
        aria-invalid={e.description ? true : undefined} aria-describedby={e.description ? `${id}-de` : undefined} />
      <Err id={`${id}-de`} msg={e.description} />
      <label htmlFor={`${id}-f`} className="block text-sm font-semibold text-navy-900">Attach the work <span className="font-normal text-muted">(optional · PDF or image, up to 10 MB)</span></label>
      <input id={`${id}-f`} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
        className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-navy-900 file:px-4 file:font-semibold file:text-white"
        aria-describedby={e.file ? `${id}-fe` : undefined} />
      <Err id={`${id}-fe`} msg={e.file} />
      <SubmitButton variant="teal" pendingLabel="Submitting…">Submit for review</SubmitButton>
    </form>
  );
}

export function ReviewWorkForm({ agreementId, revisionsLeft }: { agreementId: string; revisionsLeft: number }) {
  const [state, action] = useActionState<FormState, FormData>(reviewWorkAction, {});
  const id = useId();
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <label htmlFor={`${id}-n`} className="block text-sm font-semibold text-navy-900">Note <span className="font-normal text-muted">(required for a revision)</span></label>
      <textarea id={`${id}-n`} name="note" rows={3} maxLength={2000} className="field-input"
        aria-invalid={e.note ? true : undefined} aria-describedby={`${id}-h${e.note ? ` ${id}-ne` : ""}`} />
      <p id={`${id}-h`} className="text-xs text-muted">Review against the agreed acceptance criteria. {revisionsLeft} revision{revisionsLeft === 1 ? "" : "s"} left.</p>
      <Err id={`${id}-ne`} msg={e.note} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton name="decision" value="accept" variant="teal" pendingLabel="Saving…">Accept the work</SubmitButton>
        {revisionsLeft > 0 && <SubmitButton name="decision" value="revision" variant="outline" pendingLabel="Saving…">Request a revision</SubmitButton>}
      </div>
    </form>
  );
}

export function ReasonForm({
  agreementId,
  kind,
}: {
  agreementId: string;
  kind: "cancel" | "dispute";
}) {
  const [state, action] = useActionState<FormState, FormData>(kind === "cancel" ? cancelAgreementAction : openDisputeAction, {});
  const id = useId();
  const e = state.errors ?? {};
  return (
    <details className="rounded-2xl border border-line bg-white">
      <summary className={`flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold ${kind === "dispute" ? "text-danger-700" : "text-navy-900"}`}>
        {kind === "cancel" ? "Cancel this agreement" : "Something has gone wrong — open a dispute"}
      </summary>
      <form action={action} className="space-y-3 border-t border-line p-4">
        <input type="hidden" name="agreementId" value={agreementId} />
        {e.form && <Alert tone="danger" live>{e.form}</Alert>}
        <label htmlFor={`${id}-r`} className="block text-sm font-semibold">{kind === "cancel" ? "Reason" : "What went wrong, against the agreed terms?"}</label>
        <textarea id={`${id}-r`} name="reason" rows={3} maxLength={4000} className="field-input" required
          aria-invalid={e.reason ? true : undefined} aria-describedby={`${id}-h${e.reason ? ` ${id}-re` : ""}`} />
        <p id={`${id}-h`} className="text-xs text-muted">
          {kind === "cancel"
            ? "The other member is notified. Cancelled agreements can't be reopened."
            : "An independent SolveANeed moderator (never anyone involved) will review the agreement, history and messages. Keep all communication on the platform."}
        </p>
        <Err id={`${id}-re`} msg={e.reason} />
        <SubmitButton variant={kind === "cancel" ? "outline" : "danger"} size="sm" pendingLabel="Sending…">
          {kind === "cancel" ? "Cancel agreement" : "Open dispute"}
        </SubmitButton>
      </form>
    </details>
  );
}
