import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock } from "lucide-react";
import { requireViewer } from "@/lib/auth/session";
import { getAgreementDetail } from "@/lib/data/deals";
import { getCurrencies } from "@/lib/data/needs";
import { uuidSchema } from "@/lib/domain/validation";
import { supportTypeLabel } from "@/lib/domain/catalog";
import { FUNDING_LABEL, type AgreementStatus } from "@/lib/domain/agreement-status";
import { formatMoney } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AgreementStatusBadge } from "@/components/deals/StatusBadges";
import { TermsView } from "@/components/deals/TermsView";
import { History } from "@/components/deals/History";
import { TestModeBanner } from "@/components/deals/TestModeBanner";
import { ReasonForm, ReviewWorkForm, SubmitWorkForm } from "@/components/deals/AgreementForms";
import { confirmSupportAction, startTaskAction } from "@/app/dashboard/deals/actions";

export const metadata: Metadata = { title: "Agreement", robots: { index: false } };

const NOTICES: Record<string, string> = {
  agreed: "Agreement created. The terms are now locked. No payment has been taken.",
  started: "Work has started. The supporter has been notified.",
  submitted: "Work submitted. The supporter will review it against the acceptance criteria.",
  revision: "Revision requested. The other member has been notified.",
  accepted: "Work accepted. This task is complete.",
  confirmed: "Thank you — this support is marked as received.",
  cancelled: "This agreement has been cancelled.",
  disputed: "Dispute opened. An independent SolveANeed moderator will review it.",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function AgreementPage({ params, searchParams }: PageProps<"/dashboard/agreements/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const viewer = await requireViewer(`/dashboard/agreements/${id}`);
  const sp = await searchParams;
  const [detail, currencies] = await Promise.all([getAgreementDetail(id), getCurrencies()]);
  if (!detail) notFound();
  const { agreement: a, names, deliverables, disputes, milestones, events } = detail;
  const isRequester = viewer.id === a.requester_id;
  const status = a.status as AgreementStatus;
  const snapshot = a.terms_snapshot as { terms?: Record<string, unknown>; need_title?: string; version?: number; accepted_at?: string };
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 300) : undefined;
  const isTask = a.agreement_type === "paid_task";
  const openDispute = disputes.find((d) => d.status === "open" || d.status === "under_review");
  const lastDispute = disputes[disputes.length - 1];

  return (
    <>
      <Link href="/dashboard/agreements" className="text-sm font-semibold text-navy-900 hover:underline">← Agreements</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <AgreementStatusBadge status={status} />
        <span className="text-sm text-muted">{supportTypeLabel(a.agreement_type)}</span>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Agreement between {names.requester} and {names.supporter}</h1>
      <p className="mt-1 text-muted">For “{snapshot.need_title ?? "a need"}” · you are the {isRequester ? "requester" : "supporter"}</p>

      <div className="mt-5 space-y-3">
        {a.test_mode && <TestModeBanner />}
        {notice && <Alert tone="success" live>{notice}</Alert>}
        {error && <Alert tone="danger" live title="That didn't work">{error}</Alert>}
        <Alert tone={detail.funding === "funded" ? "success" : "warning"} title={FUNDING_LABEL[detail.funding]}>
          {detail.funding === "funded"
            ? "A provider-confirmed payment exists for this agreement."
            : "Payments are not yet available on SolveANeed. This agreement is not funded and no money has moved or been promised by SolveANeed."}
        </Alert>
        {openDispute && (
          <Alert tone="danger" title="In dispute">
            An independent SolveANeed moderator is reviewing this agreement. Keep all communication on the platform.
          </Alert>
        )}
        {lastDispute?.status === "resolved" && lastDispute.resolution && (
          <Alert tone="info" title={`Dispute resolved — ${lastDispute.outcome === "complete" ? "completed" : "cancelled"}`}>
            <span className="whitespace-pre-line">{lastDispute.resolution}</span>
          </Alert>
        )}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          {/* Next step for this member */}
          {isTask && (
            <section className="card space-y-4 p-6" aria-labelledby="next-h">
              <h2 id="next-h" className="text-lg font-bold">Next step</h2>
              {status === "awaiting_payment_readiness" && (isRequester ? (
                <>
                  <p className="text-sm">
                    Don&apos;t start work until payment is ready. Payments are not yet available, so in the live service this task stays here.
                  </p>
                  <form action={startTaskAction}>
                    <input type="hidden" name="agreementId" value={a.id} />
                    <SubmitButton variant="teal" pendingLabel="Starting…">Start work</SubmitButton>
                  </form>
                  <p className="text-xs text-muted">Starting is only possible in the test environment, where the agreement is permanently labelled as a test.</p>
                </>
              ) : (
                <p className="text-sm">Waiting for payment readiness. {names.requester} has been told not to start work until then.</p>
              ))}
              {(status === "active" || status === "revision_requested") && (isRequester ? (
                <>
                  {status === "revision_requested" && deliverables.length > 0 && (
                    <Alert tone="warning" title="Revision requested">
                      <span className="whitespace-pre-line">{deliverables[deliverables.length - 1].review_note}</span>
                    </Alert>
                  )}
                  {detail.conversationId && <SubmitWorkForm agreementId={a.id} conversationId={detail.conversationId} />}
                </>
              ) : (
                <p className="text-sm">{names.requester} is working on this task. You&apos;ll be notified when work is submitted.</p>
              ))}
              {status === "submitted" && (!isRequester ? (
                <>
                  <p className="text-sm">
                    Review the submission against the acceptance criteria. If you don&apos;t respond within {Math.round(a.dispute_window_hours / 24)} days of submission,
                    the work is accepted automatically.
                  </p>
                  <ReviewWorkForm agreementId={a.id} revisionsLeft={a.max_revisions - a.revisions_used} />
                </>
              ) : (
                <p className="text-sm">Submitted on {fmtDate(a.submitted_at)}. Waiting for {names.supporter} to review it.</p>
              ))}
              {status === "completed" && <p className="text-sm">Completed on {fmtDate(a.completed_at)}.</p>}
              {status === "cancelled" && <p className="text-sm">Cancelled on {fmtDate(a.cancelled_at)}.</p>}
              {status === "disputed" && <p className="text-sm">Actions are paused while the dispute is reviewed.</p>}
            </section>
          )}

          {a.agreement_type === "direct_support" && status === "active" && (
            <section className="card space-y-3 p-6" aria-labelledby="ds-h">
              <h2 id="ds-h" className="text-lg font-bold">Next step</h2>
              <p className="text-sm">Meet online or in a public place only, and keep contact on SolveANeed.</p>
              {isRequester ? (
                <form action={confirmSupportAction}>
                  <input type="hidden" name="agreementId" value={a.id} />
                  <SubmitButton variant="teal" pendingLabel="Saving…">I have received this support</SubmitButton>
                </form>
              ) : (
                <p className="text-sm text-muted">{names.requester} will confirm once the support has been received.</p>
              )}
            </section>
          )}

          {(a.agreement_type === "gift" || a.agreement_type === "milestone") && status === "awaiting_payment_readiness" && (
            <Alert tone="info" title="What happens next">
              {a.agreement_type === "gift"
                ? "When payments launch, the supporter will be asked to complete this gift through SolveANeed's regulated payment provider. Until then nothing is owed or paid."
                : "When payments launch, each milestone will be funded and released separately against its evidence. Until then nothing is owed or paid."}
            </Alert>
          )}

          {isTask && deliverables.length > 0 && (
            <section className="card p-6" aria-labelledby="sub-h">
              <h2 id="sub-h" className="text-lg font-bold">Submissions</h2>
              <ol className="mt-4 space-y-4">
                {deliverables.map((d, i) => (
                  <li key={d.id} className="rounded-2xl border border-line p-4">
                    <p className="text-sm font-semibold text-navy-900">Submission {i + 1} · {fmtDate(d.submitted_at)}</p>
                    <p className="mt-2 whitespace-pre-line text-sm">{d.description}</p>
                    {d.storage_path && detail.filesByPath[d.storage_path] && (
                      <a href={`/api/files/${detail.filesByPath[d.storage_path].id}`} className="mt-2 inline-block text-sm font-semibold text-navy-900 underline">
                        {detail.filesByPath[d.storage_path].file_name}
                      </a>
                    )}
                    <p className="mt-2 text-xs text-muted">
                      Review: {d.review_status.replace("_", " ")}{d.review_note ? ` — ${d.review_note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card p-6" aria-labelledby="terms-h">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="terms-h" className="flex items-center gap-2 text-lg font-bold"><Lock className="size-4" aria-hidden="true" /> Agreed terms</h2>
              <p className="text-xs text-muted">Version {snapshot.version} · accepted {fmtDate(snapshot.accepted_at ?? a.created_at)}</p>
            </div>
            <div className="mt-3">
              <TermsView type={a.agreement_type} amountMinor={a.amount_minor} currency={a.currency} terms={snapshot.terms ?? {}} currencies={currencies} />
            </div>
            {milestones.length > 0 && (
              <p className="mt-4 text-sm text-muted">{milestones.length} milestone{milestones.length === 1 ? "" : "s"} recorded — none funded.</p>
            )}
            <p className="mt-4 break-all rounded-xl bg-soft p-3 font-mono text-xs text-muted">
              Terms fingerprint (SHA-256): {a.terms_sha256}
            </p>
            <p className="mt-2 text-xs text-muted">These terms cannot be changed. The fingerprint lets either party prove exactly what was agreed.</p>
          </section>

          <div className="space-y-3">
            {(status === "awaiting_payment_readiness"
              || (a.agreement_type === "direct_support" && status === "active")
              || (isRequester && (status === "active" || status === "revision_requested"))) && (
              <ReasonForm agreementId={a.id} kind="cancel" />
            )}
            {["active", "submitted", "revision_requested"].includes(status) && <ReasonForm agreementId={a.id} kind="dispute" />}
          </div>
        </div>

        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="sum-h">
            <h2 id="sum-h" className="text-lg font-bold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {a.agreement_type !== "direct_support" && (
                <div className="flex justify-between gap-3"><dt className="text-muted">Amount</dt><dd className="font-semibold">{formatMoney({ amountMinor: a.amount_minor, currency: a.currency }, { list: currencies })}</dd></div>
              )}
              <div className="flex justify-between gap-3"><dt className="text-muted">Funding</dt><dd className="font-semibold">{detail.funding === "funded" ? "Funded" : "Not funded"}</dd></div>
              {isTask && <div className="flex justify-between gap-3"><dt className="text-muted">Revisions used</dt><dd className="font-semibold">{a.revisions_used} of {a.max_revisions}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-muted">Created</dt><dd>{fmtDate(a.created_at)}</dd></div>
            </dl>
            <ButtonLink href={`/dashboard/offers/${a.offer_id}`} variant="outline" className="mt-5 w-full">Messages and offer history</ButtonLink>
          </section>
          <section className="card p-6" aria-labelledby="audit-h">
            <h2 id="audit-h" className="text-lg font-bold">Audit history</h2>
            <p className="mt-1 text-xs text-muted">Every step is recorded permanently.</p>
            <div className="mt-4"><History events={events} names={names} requesterId={a.requester_id} /></div>
          </section>
        </aside>
      </div>
    </>
  );
}
