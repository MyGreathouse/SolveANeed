import { FlaskConical } from "lucide-react";

/** Shown on every agreement that was started without a payment (test/staging only). */
export function TestModeBanner() {
  return (
    <div role="note" className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-warning-700/50 bg-warning-50 px-4 py-3 text-sm text-warning-700">
      <FlaskConical className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <p>
        <strong>Test environment — no money moves.</strong> This agreement was started without a payment so the workflow can be
        tested. Nothing here is a real payment, payout or financial commitment.
      </p>
    </div>
  );
}
