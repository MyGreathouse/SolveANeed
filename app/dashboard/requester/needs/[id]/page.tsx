import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { getCurrencies, getMyNeed, listEvidence } from "@/lib/data/needs";
import { currencyOptions } from "@/lib/data/currency-options";
import { uuidSchema } from "@/lib/domain/validation";
import { isNeedEditable } from "@/lib/domain/need-status";
import { categoryLabel, supportTypeLabel } from "@/lib/domain/catalog";
import { formatMoney, getCurrency, minorToMajorString } from "@/lib/money";
import { NeedForm } from "@/components/needs/NeedForm";
import { NeedStatusBadge } from "@/components/needs/NeedStatusBadge";
import { EvidenceUpload } from "@/components/needs/EvidenceUpload";
import { EvidenceList } from "@/components/needs/EvidenceList";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { closeNeedAction, deleteDraftAction, submitNeedAction } from "../actions";

export const metadata: Metadata = { title: "Manage need" };

const NOTICES: Record<string, string> = {
  saved: "Your changes have been saved.",
  submitted: "Submitted for review. We'll notify you when a moderator has reviewed your need.",
  closed: "This need is now closed.",
};

export default async function ManageNeedPage({ params, searchParams }: PageProps<"/dashboard/requester/needs/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const viewer = await requireRole(["requester"], { next: `/dashboard/requester/needs/${id}` });
  if (!uuidSchema.safeParse(id).success) notFound();
  const [need, currencies] = await Promise.all([getMyNeed(viewer.id, id), getCurrencies()]);
  if (!need) notFound();
  const files = await listEvidence(need.id);
  const editable = isNeedEditable(need.status);
  const info = getCurrency(need.currency, currencies);
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const submitError = typeof sp.submitError === "string" ? sp.submitError.slice(0, 300) : undefined;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/requester/needs" className="text-sm font-semibold text-navy-900 hover:underline">← My Needs</Link>
          <div className="mt-2 flex items-center gap-3"><NeedStatusBadge status={need.status} /></div>
          <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{need.title}</h1>
        </div>
        {need.status === "published" && <ButtonLink href={`/needs/${need.id}`} variant="outline">View public page</ButtonLink>}
      </div>

      <div className="space-y-4">
        {notice && <Alert tone="success" live>{notice}</Alert>}
        {submitError && <Alert tone="danger" live title="Not submitted yet">{submitError}</Alert>}
        {need.moderation_note && (need.status === "changes_requested" || need.status === "rejected" || need.status === "suspended") && (
          <Alert tone="warning" title="Message from our moderators">{need.moderation_note}</Alert>
        )}
        {need.status === "pending_review" && <Alert tone="info" title="Under review">Your need is locked while a moderator reviews it. You&apos;ll get a notification when there&apos;s an update.</Alert>}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_20rem]">
        <div>
          {editable ? (
            <NeedForm
              currencies={currencyOptions(currencies)}
              defaults={{
                needId: need.id,
                title: need.title,
                categorySlug: need.category_slug,
                description: need.description,
                amount: need.amount_minor != null ? minorToMajorString(need.amount_minor, info.minorUnit) : "",
                currency: need.currency,
                intendedUse: need.intended_use ?? "",
                region: need.region ?? "",
                acceptedSupportTypes: need.accepted_support_types,
                deadline: need.deadline ?? "",
                visibility: need.visibility,
                showRequesterName: need.show_requester_name,
              }}
            />
          ) : (
            <dl className="card grid gap-5 p-6 sm:grid-cols-2 md:p-8">
              <div><dt className="text-sm text-muted">Category</dt><dd className="font-semibold">{categoryLabel(need.category_slug)}</dd></div>
              <div><dt className="text-sm text-muted">Amount</dt><dd className="font-semibold">{need.amount_minor != null ? formatMoney({ amountMinor: need.amount_minor, currency: need.currency }, { list: currencies }) : "—"}</dd></div>
              <div><dt className="text-sm text-muted">Supported so far</dt><dd className="font-semibold">{formatMoney({ amountMinor: need.funded_minor, currency: need.currency }, { list: currencies })}</dd></div>
              <div><dt className="text-sm text-muted">Accepts</dt><dd className="font-semibold">{need.accepted_support_types.map(supportTypeLabel).join(", ")}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-muted">Description</dt><dd className="mt-1 whitespace-pre-line">{need.description}</dd></div>
              <div className="sm:col-span-2"><dt className="text-sm text-muted">Intended use</dt><dd className="mt-1 whitespace-pre-line">{need.intended_use}</dd></div>
            </dl>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card space-y-4 p-5" aria-labelledby="evidence-title">
            <h2 id="evidence-title" className="font-bold">Supporting evidence</h2>
            <p className="text-sm text-muted">Only you and SolveANeed moderators can see these files. They are never shown publicly.</p>
            <EvidenceList files={files} canDelete={editable} needId={need.id} />
            {editable ? <EvidenceUpload needId={need.id} /> : <p className="text-xs text-muted">Evidence can be changed while a need is a draft or when changes are requested.</p>}
          </section>

          <section className="card space-y-3 p-5" aria-labelledby="actions-title">
            <h2 id="actions-title" className="font-bold">Actions</h2>
            {editable && (
              <form action={submitNeedAction}>
                <input type="hidden" name="needId" value={need.id} />
                <SubmitButton variant="gold" className="w-full" pendingLabel="Submitting…">Submit saved version for review</SubmitButton>
              </form>
            )}
            {need.status === "published" && (
              <form action={closeNeedAction}>
                <input type="hidden" name="needId" value={need.id} />
                <SubmitButton variant="outline" className="w-full" pendingLabel="Closing…">Close this need</SubmitButton>
                <p className="mt-2 text-xs text-muted">Close it when the need has been met or is no longer needed. This cannot be undone.</p>
              </form>
            )}
            {need.status === "draft" && (
              <form action={deleteDraftAction}>
                <input type="hidden" name="needId" value={need.id} />
                <SubmitButton variant="ghost" className="w-full text-danger-700" pendingLabel="Deleting…">Delete draft</SubmitButton>
              </form>
            )}
            {!editable && need.status !== "published" && <p className="text-sm text-muted">No actions are available while the need is {need.status.replace("_", " ")}.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
