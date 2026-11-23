"use client";

import { useActionState, useRef } from "react";
import { uploadEvidenceAction } from "@/app/dashboard/requester/needs/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Alert } from "@/components/ui/Alert";
import type { FormState } from "@/lib/utils/form";

export function EvidenceUpload({ needId }: { needId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await uploadEvidenceAction(prev, fd);
    if (res.ok) formRef.current?.reset();
    return res;
  }, {});
  const err = state.errors?.file ?? state.errors?.form;
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="needId" value={needId} />
      <label htmlFor="evidence-file" className="block text-sm font-semibold text-navy-900">Add a file</label>
      <p id="evidence-hint" className="text-sm text-muted">PDF, JPG, PNG or WebP, up to 10 MB. Remove personal details you don&apos;t need to share (e.g. bank numbers).</p>
      <input
        id="evidence-file"
        name="file"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-full file:border-0 file:bg-navy-900 file:px-4 file:font-semibold file:text-white"
        aria-describedby={`evidence-hint${err ? " evidence-error" : ""}`}
        aria-invalid={err ? true : undefined}
        required
      />
      {err && <p id="evidence-error" className="text-sm font-medium text-danger-700" role="alert">{err}</p>}
      {state.ok && <Alert tone="success" live>{state.message}</Alert>}
      <SubmitButton variant="teal" size="sm" pendingLabel="Uploading…">Upload privately</SubmitButton>
    </form>
  );
}
