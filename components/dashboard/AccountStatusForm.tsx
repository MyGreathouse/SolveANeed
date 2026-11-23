"use client";

import { useActionState, useId } from "react";
import { setAccountStatusAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { FormState } from "@/lib/utils/form";

export function AccountStatusForm({ userId, status }: { userId: string; status: string }) {
  const [state, action] = useActionState<FormState, FormData>(setAccountStatusAction, {});
  const id = useId();
  const next = status === "suspended" ? "active" : "suspended";
  if (state.ok) return <p className="text-sm font-semibold text-teal-700" role="status">{state.message}</p>;
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="status" value={next} />
      <div className="flex-1">
        <label htmlFor={`${id}-reason`} className="sr-only">Reason</label>
        <input id={`${id}-reason`} name="reason" placeholder="Reason (recorded in audit log)" className="field-input min-h-10 py-1.5 text-sm" maxLength={500} aria-invalid={state.errors?.reason ? true : undefined} />
        {(state.errors?.reason || state.errors?.form) && <p className="mt-1 text-xs text-danger-700" role="alert">{state.errors.reason ?? state.errors.form}</p>}
      </div>
      <SubmitButton size="sm" variant={next === "suspended" ? "danger" : "teal"} pendingLabel="Saving…">{next === "suspended" ? "Suspend" : "Reinstate"}</SubmitButton>
    </form>
  );
}
