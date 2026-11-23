import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getConversation, getOfferDetail } from "@/lib/data/deals";
import { getCurrencies, currencyFor } from "@/lib/data/needs";
import { uuidSchema } from "@/lib/domain/validation";
import { supportTypeLabel, type SupportType } from "@/lib/domain/catalog";
import type { OfferStatus } from "@/lib/domain/offer-status";
import { formatMoney, minorToMajorString } from "@/lib/money";
import { Alert } from "@/components/ui/Alert";
import { ButtonLink } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ReportForm } from "@/components/needs/ReportForm";
import { OfferStatusBadge } from "@/components/deals/StatusBadges";
import { TermsView } from "@/components/deals/TermsView";
import { History } from "@/components/deals/History";
import { OfferForm } from "@/components/deals/OfferForm";
import { ConversationPanel } from "@/components/deals/ConversationPanel";
import { acceptOfferAction, declineOfferAction, withdrawOfferAction } from "@/app/dashboard/deals/actions";

export const metadata: Metadata = { title: "Offer", robots: { index: false } };

const NOTICES: Record<string, string> = {
  created: "Your offer has been sent. You'll be notified when the requester responds.",
  countered: "Your new terms have been sent.",
  declined: "You declined this offer.",
  withdrawn: "You withdrew this offer.",
  blocked: "Member blocked. They can no longer message you or make new offers.",
};

export default async function OfferPage({ params, searchParams }: PageProps<"/dashboard/offers/[id]">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const viewer = await requireViewer(`/dashboard/offers/${id}`);
  const sp = await searchParams;
  const [detail, currencies] = await Promise.all([getOfferDetail(id), getCurrencies()]);
  if (!detail) notFound();
  const { offer, versions, events, names, agreement } = detail;
  const isRequester = viewer.id === offer.requester_id;
  const otherName = isRequester ? names.supporter : names.requester;
  const current = versions.find((v) => v.version === offer.current_version) ?? versions[versions.length - 1];
  const open = offer.status === "proposed" || offer.status === "countered";
  const expired = offer.expires_at != null && new Date(offer.expires_at) <= new Date();
  const myTurn = open && !expired && offer.last_proposed_by !== viewer.id;
  const info = currencyFor(offer.currency, currencies);
  const symbol = formatMoney({ amountMinor: 0, currency: offer.currency }, { list: currencies }).replace(/[\d.,\s]/g, "") || offer.currency;
  const conversation = detail.conversationId
    ? await getConversation(detail.conversationId, viewer.id, isRequester ? offer.supporter_id : offer.requester_id)
    : null;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const error = typeof sp.error === "string" ? sp.error.slice(0, 300) : undefined;
  const terms = (current?.terms ?? {}) as Record<string, unknown>;
  const milestoneAmounts = Array.isArray(terms.milestones)
    ? (terms.milestones as { amount_minor: number }[]).map((m) => minorToMajorString(Number(m.amount_minor), info.minorUnit))
    : undefined;

  return (
    <>
      <Link href={isRequester ? "/dashboard/requester/offers" : "/dashboard/supporter/offers"} className="text-sm font-semibold text-navy-900 hover:underline">
        ← {isRequester ? "Offers Received" : "Offers Made"}
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <OfferStatusBadge status={offer.status as OfferStatus} />
        <span className="text-sm text-muted">{supportTypeLabel(offer.offer_type)} · version {offer.current_version}</span>
      </div>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
        {isRequester ? `Offer from ${names.supporter}` : `Your offer to ${names.requester}`}
      </h1>
      <p className="mt-1 text-muted">For “{detail.needTitle}”</p>

      <div className="mt-5 space-y-3">
        {notice && <Alert tone="success" live>{notice}</Alert>}
        {sp.warn === "1" && (
          <Alert tone="warning" title="Safety reminder">
            Your terms mention contact details or paying outside SolveANeed. Keep everything on the platform — our team may review this offer.
          </Alert>
        )}
        {error && <Alert tone="danger" live title="That didn't work">{error}</Alert>}
        {offer.status === "accepted" && agreement && (
          <Alert tone="info" title="Agreed — not funded">
            This offer became an agreement. No payment has been taken and no money has moved.{" "}
            <Link href={`/dashboard/agreements/${agreement.id}`} className="font-semibold underline">Open the agreement</Link>
          </Alert>
        )}
        {open && expired && <Alert tone="warning">This offer has expired and can no longer be accepted.</Alert>}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-8">
          <section className="card p-6" aria-labelledby="terms-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="terms-h" className="text-lg font-bold">Current terms (version {current?.version})</h2>
              {current && <p className="text-xs text-muted">Proposed by {current.proposed_by === offer.requester_id ? names.requester : names.supporter}</p>}
            </div>
            {current && (
              <div className="mt-3">
                <TermsView type={offer.offer_type} amountMinor={current.amount_minor} currency={offer.currency} terms={terms} currencies={currencies} />
              </div>
            )}

            {myTurn && (
              <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-6">
                <form action={acceptOfferAction}>
                  <input type="hidden" name="offerId" value={offer.id} />
                  <input type="hidden" name="version" value={offer.current_version} />
                  <SubmitButton variant="teal" pendingLabel="Accepting…">Accept version {offer.current_version}</SubmitButton>
                </form>
                {isRequester && (
                  <form action={declineOfferAction} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="offerId" value={offer.id} />
                    <label htmlFor="decline-reason" className="sr-only">Reason for declining (optional)</label>
                    <input id="decline-reason" name="reason" placeholder="Reason (optional)" maxLength={1000} className="field-input h-11 w-56" />
                    <SubmitButton variant="outline" pendingLabel="Declining…">Decline</SubmitButton>
                  </form>
                )}
              </div>
            )}
            {open && !myTurn && !expired && (
              <p className="mt-6 border-t border-line pt-5 text-sm text-muted">Waiting for {otherName} to respond to version {offer.current_version}.</p>
            )}
            {open && !isRequester && (
              <form action={withdrawOfferAction} className="mt-4">
                <input type="hidden" name="offerId" value={offer.id} />
                <SubmitButton variant="ghost" size="sm" pendingLabel="Withdrawing…">Withdraw my offer</SubmitButton>
              </form>
            )}
          </section>

          {myTurn && (
            <section className="card p-6" aria-labelledby="counter-h">
              <details>
                <summary className="cursor-pointer text-lg font-bold text-navy-900" id="counter-h">Propose different terms</summary>
                <p className="mt-2 text-sm text-muted">This creates version {offer.current_version + 1}. Earlier versions are kept and can&apos;t be changed.</p>
                <div className="mt-5">
                  <OfferForm
                    mode="counter"
                    offerId={offer.id}
                    version={offer.current_version}
                    fixedType={offer.offer_type as SupportType}
                    allowedTypes={[offer.offer_type as SupportType]}
                    currency={{ code: info.code, symbol }}
                    defaults={{ amount: minorToMajorString(current?.amount_minor ?? 0, info.minorUnit), terms, milestoneAmounts }}
                  />
                </div>
              </details>
            </section>
          )}

          {conversation && (
            <ConversationPanel
              conversation={conversation}
              offerId={offer.id}
              viewerId={viewer.id}
              otherName={otherName}
              canSend={!["declined", "expired", "cancelled"].includes(offer.status)}
            />
          )}
        </div>

        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="hist-h">
            <h2 id="hist-h" className="text-lg font-bold">History</h2>
            <div className="mt-4"><History events={events} names={names} requesterId={offer.requester_id} /></div>
          </section>
          {versions.length > 1 && (
            <section className="card p-6" aria-labelledby="ver-h">
              <h2 id="ver-h" className="text-lg font-bold">All versions</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {versions.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3">
                    <span>v{v.version} · {v.proposed_by === offer.requester_id ? names.requester : names.supporter}</span>
                    <span className="font-semibold">{offer.offer_type === "direct_support" ? "Non-cash" : formatMoney({ amountMinor: v.amount_minor, currency: offer.currency }, { list: currencies })}</span>
                  </li>
                ))}
              </ul>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold text-navy-900">Compare earlier terms</summary>
                <div className="mt-3 space-y-5">
                  {versions.filter((v) => v.version !== offer.current_version).map((v) => (
                    <div key={v.id}>
                      <p className="font-semibold">Version {v.version}</p>
                      <TermsView type={offer.offer_type} amountMinor={v.amount_minor} currency={offer.currency} terms={v.terms as Record<string, unknown>} currencies={currencies} />
                    </div>
                  ))}
                </div>
              </details>
            </section>
          )}
          <ReportForm targetType="offer" targetId={offer.id} label="Report this offer" />
          {agreement && <ButtonLink href={`/dashboard/agreements/${agreement.id}`} variant="navy" className="w-full">View agreement</ButtonLink>}
        </aside>
      </div>
    </>
  );
}
