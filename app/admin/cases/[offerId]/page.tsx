import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies } from "@/lib/data/needs";
import { uuidSchema } from "@/lib/domain/validation";
import { supportTypeLabel } from "@/lib/domain/catalog";
import type { AgreementStatus } from "@/lib/domain/agreement-status";
import type { OfferStatus } from "@/lib/domain/offer-status";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { AgreementStatusBadge, OfferStatusBadge } from "@/components/deals/StatusBadges";
import { TermsView } from "@/components/deals/TermsView";
import { History } from "@/components/deals/History";
import { TestModeBanner } from "@/components/deals/TestModeBanner";
import { resolveDisputeAction } from "../../actions";

export const metadata: Metadata = { title: "Case" };

export default async function CasePage({ params, searchParams }: PageProps<"/admin/cases/[offerId]">) {
  const { viewer } = await requireStaff();
  const { offerId } = await params;
  if (!uuidSchema.safeParse(offerId).success) notFound();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: offer } = await supabase.from("offers").select("*").eq("id", offerId).maybeSingle();
  if (!offer) notFound();
  const [{ data: agreement }, { data: events }, { data: names }, { data: versions }, { data: convId }, currencies] = await Promise.all([
    supabase.from("agreements").select("*").eq("offer_id", offerId).maybeSingle(),
    supabase.from("deal_events").select("*").eq("offer_id", offerId).order("id"),
    supabase.rpc("deal_party_names", { p_offer_id: offerId }),
    supabase.from("offer_versions").select("*").eq("offer_id", offerId).order("version"),
    supabase.rpc("staff_conversation_id", { p_offer_id: offerId }),
    getCurrencies(),
  ]);
  const { data: disputes } = agreement
    ? await supabase.from("disputes").select("*").eq("agreement_id", agreement.id).order("opened_at")
    : { data: [] };
  const n = (names ?? [])[0] ?? { requester_name: "Requester", supporter_name: "Supporter" };
  const party = { requester: n.requester_name, supporter: n.supporter_name };
  const isParty = viewer.id === offer.requester_id || viewer.id === offer.supporter_id;
  const openDispute = (disputes ?? []).find((d) => d.status === "open" || d.status === "under_review");
  const current = (versions ?? []).find((v) => v.version === offer.current_version);

  // Messages are only loaded on request, and only while the case is in scope; each load is audit-logged.
  let messages: { id: string; sender_role: string; body: string; flags: string[]; file_id: string | null; created_at: string }[] | null = null;
  let scopeError: string | null = null;
  if (sp.show === "messages" && typeof convId === "string") {
    const { data, error } = await supabase.rpc("staff_read_conversation", { p_conversation_id: convId });
    if (error) scopeError = "This conversation is not part of an open case (no open report, dispute or unreviewed flag).";
    else messages = data ?? [];
  }

  return (
    <>
      <Link href="/admin/disputes" className="text-sm font-semibold underline">← Disputes & safety</Link>
      <h1 className="text-2xl font-extrabold">Case: {supportTypeLabel(offer.offer_type)} between {party.requester} and {party.supporter}</h1>
      <div className="flex flex-wrap gap-2">
        <OfferStatusBadge status={offer.status as OfferStatus} />
        {agreement && <AgreementStatusBadge status={agreement.status as AgreementStatus} />}
      </div>
      {agreement?.test_mode && <TestModeBanner />}
      {sp.done === "resolved" && <Alert tone="success" live>Dispute resolved. Both parties have been notified.</Alert>}
      {typeof sp.error === "string" && <Alert tone="danger" live>{sp.error.slice(0, 300)}</Alert>}
      {isParty && <Alert tone="warning" title="You are a party to this case">You cannot decide it. Ask another moderator.</Alert>}

      {openDispute && agreement && (
        <section className="card space-y-3 p-6" aria-labelledby="dispute-h">
          <h2 id="dispute-h" className="text-lg font-bold">Open dispute</h2>
          <p className="text-sm"><strong>Opened by {openDispute.opened_by === offer.requester_id ? party.requester : party.supporter}</strong> on {new Date(openDispute.opened_at).toLocaleString("en-GB")}</p>
          <p className="whitespace-pre-line rounded-xl bg-soft p-3 text-sm">{openDispute.reason}</p>
          {!isParty && (
            <form action={resolveDisputeAction} className="space-y-3">
              <input type="hidden" name="disputeId" value={openDispute.id} />
              <input type="hidden" name="offerId" value={offer.id} />
              <fieldset>
                <legend className="text-sm font-semibold">Outcome</legend>
                <div className="mt-2 flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name="outcome" value="complete" required className="size-4" />Complete (work accepted)</label>
                  <label className="flex items-center gap-2"><input type="radio" name="outcome" value="cancel" className="size-4" />Cancel the agreement</label>
                </div>
              </fieldset>
              <label htmlFor="resolution" className="block text-sm font-semibold">Decision and reasons (shared with both parties)</label>
              <textarea id="resolution" name="resolution" required minLength={20} maxLength={4000} rows={4} className="field-input" />
              <p className="text-xs text-muted">No money moves on resolution: payments are not live. When they are, outcomes will map to release or refund through the provider.</p>
              <SubmitButton variant="navy" pendingLabel="Saving…">Resolve dispute</SubmitButton>
            </form>
          )}
        </section>
      )}

      <section className="card p-6" aria-labelledby="t-h">
        <h2 id="t-h" className="text-lg font-bold">{agreement ? "Agreed terms" : `Current terms (version ${offer.current_version})`}</h2>
        <div className="mt-3">
          {agreement ? (
            <TermsView type={agreement.agreement_type} amountMinor={agreement.amount_minor} currency={agreement.currency}
              terms={((agreement.terms_snapshot as { terms?: Record<string, unknown> }).terms) ?? {}} currencies={currencies} />
          ) : current ? (
            <TermsView type={offer.offer_type} amountMinor={current.amount_minor} currency={offer.currency} terms={current.terms as Record<string, unknown>} currencies={currencies} />
          ) : null}
        </div>
        {agreement && <p className="mt-3 break-all font-mono text-xs text-muted">SHA-256 {agreement.terms_sha256}</p>}
      </section>

      <section className="card p-6" aria-labelledby="h-h">
        <h2 id="h-h" className="text-lg font-bold">History</h2>
        <div className="mt-4"><History events={events ?? []} names={party} requesterId={offer.requester_id} /></div>
      </section>

      <section className="card space-y-3 p-6" aria-labelledby="m-h">
        <h2 id="m-h" className="text-lg font-bold">Conversation</h2>
        {messages === null ? (
          <>
            {scopeError && <Alert tone="warning">{scopeError}</Alert>}
            <p className="text-sm text-muted">Messages are private. Opening them is allowed only within an open case, and is recorded in the audit log with your name.</p>
            <Link href={`/admin/cases/${offer.id}?show=messages`} className="inline-flex min-h-11 items-center rounded-full border border-navy-900/25 px-4 text-sm font-semibold text-navy-900">Open conversation (logged)</Link>
          </>
        ) : (
          <ol className="space-y-3">
            {messages.length === 0 && <li className="text-sm text-muted">No messages.</li>}
            {messages.map((m) => (
              <li key={m.id} className="rounded-2xl bg-soft p-3 text-sm">
                <p className="text-xs font-semibold text-muted">{m.sender_role === "requester" ? party.requester : party.supporter} · {new Date(m.created_at).toLocaleString("en-GB")}{m.flags.length ? ` · flagged: ${m.flags.join(", ")}` : ""}</p>
                <p className="mt-1 whitespace-pre-line break-words">{m.body}</p>
                {m.file_id && <a href={`/api/files/${m.file_id}`} className="mt-1 inline-block font-semibold underline">Open attachment (logged)</a>}
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
