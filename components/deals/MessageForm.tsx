"use client";

import { useActionState, useId, useRef } from "react";
import { sendMessageAction } from "@/app/dashboard/deals/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export function MessageForm({ conversationId, offerId }: { conversationId: string; offerId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await sendMessageAction(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  const id = useId();
  const bodyErr = state.errors?.body;
  const fileErr = state.errors?.file;
  const warned = state.ok && state.message && state.message !== "Message sent.";
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="conversationId" value={conversationId} />
      <input type="hidden" name="offerId" value={offerId} />
      <label htmlFor={`${id}-body`} className="block text-sm font-semibold text-navy-900">Your message</label>
      <textarea
        id={`${id}-body`}
        name="body"
        rows={3}
        maxLength={4000}
        required
        className="field-input"
        aria-describedby={`${id}-hint${bodyErr ? ` ${id}-err` : ""}`}
        aria-invalid={bodyErr ? true : undefined}
      />
      <p id={`${id}-hint`} className="text-xs text-muted">
        Keep contact and payments on SolveANeed. Never share bank, card or ID details — we will never ask for them in a message.
      </p>
      {bodyErr && <p id={`${id}-err`} className="text-sm font-medium text-danger-700" role="alert">{bodyErr}</p>}
      <div>
        <label htmlFor={`${id}-file`} className="block text-sm font-semibold text-navy-900">Attach a file <span className="font-normal text-muted">(optional)</span></label>
        <input id={`${id}-file`} name="file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"
          className="mt-1 block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-navy-900 file:px-4 file:font-semibold file:text-white"
          aria-describedby={fileErr ? `${id}-ferr` : undefined} />
        {fileErr && <p id={`${id}-ferr`} className="text-sm font-medium text-danger-700" role="alert">{fileErr}</p>}
      </div>
      {state.ok && (warned ? <Alert tone="warning" live title="Safety reminder">{state.message}</Alert> : <Alert tone="success" live>{state.message}</Alert>)}
      <SubmitButton variant="navy" size="sm" pendingLabel="Sending…">Send message</SubmitButton>
    </form>
  );
}
