"use client";

import { useActionState } from "react";
import { moderateNeedAction } from "@/app/admin/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

const LABELS: Record<string, string> = {
  approve: "Approve and publish",
  request_changes: "Request changes",
  reject: "Reject",
  suspend: "Suspend",
  reinstate: "Reinstate",
  mark_evidence_reviewed: "Mark evidence reviewed",
};

export function ModerationForm({ needId, actions }: { needId: string; actions: string[] }) {
  const [state, action] = useActionState<FormState, FormData>(moderateNeedAction, {});
  const e = state.errors ?? {};
  if (!actions.length) return <p className="text-sm text-muted">No moderation actions are available in this status.</p>;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="needId" value={needId} />
      {e.form && <Alert tone="danger" live>{e.form}</Alert>}
      <div>
        <label htmlFor="note" className="block text-sm font-semibold">Note to requester</label>
        <p id="note-hint" className="text-xs text-muted">Required for changes, rejection and suspension. The requester will see this.</p>
        <textarea id="note" name="note" rows={4} maxLength={2000} className="field-input mt-1.5" aria-describedby={`note-hint${e.note ? " note-error" : ""}`} aria-invalid={e.note ? true : undefined} />
        {e.note && <p id="note-error" className="mt-1 text-sm font-medium text-danger-700" role="alert">{e.note}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <SubmitButton
            key={a}
            name="action"
            value={a}
            size="sm"
            variant={a === "approve" || a === "reinstate" ? "teal" : a === "reject" || a === "suspend" ? "danger" : "outline"}
            pendingLabel="Working…"
          >
            {LABELS[a]}
          </SubmitButton>
        ))}
      </div>
    </form>
  );
}
