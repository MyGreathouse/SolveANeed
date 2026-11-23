import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { getCurrencies, listEvidence, type OwnNeed } from "@/lib/data/needs";
import { uuidSchema } from "@/lib/domain/validation";
import { categoryLabel, supportTypeLabel } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/money";
import { NeedStatusBadge } from "@/components/needs/NeedStatusBadge";
import { EvidenceList } from "@/components/needs/EvidenceList";
import { ModerationForm } from "@/components/dashboard/ModerationForm";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { reviewSignalAction } from "../../actions";

export const metadata: Metadata = { title: "Review need" };

function actionsFor(n: OwnNeed): string[] {
  const a: string[] = [];
  if (n.status === "pending_review") a.push("approve", "request_changes", "reject");
  if (n.status === "published") a.push("suspend");
  if (n.status === "suspended") a.push("reinstate");
  if (!n.evidence_reviewed_at && ["pending_review", "published"].includes(n.status)) a.push("mark_evidence_reviewed");
  return a;
}

export default async function AdminNeedPage({ params, searchParams }: PageProps<"/admin/needs/[id]">) {
  const { viewer } = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: need } = await supabase.from("needs").select("*").eq("id", id).maybeSingle<OwnNeed>();
  if (!need) notFound();
  const [files, currencies, { data: requester }, { data: signals }, { data: history }, { count: priorNeeds }, { data: inScope }] = await Promise.all([
    listEvidence(need.id),
    getCurrencies(),
    supabase.from("profiles").select("display_name, created_at, identity_verified_at, account_status").eq("id", need.requester_id).maybeSingle(),
    supabase.from("risk_signals").select("id, signal, detail, reviewed_at, created_at").eq("entity_type", "need").eq("entity_id", need.id).order("created_at"),
    supabase.from("moderation_actions").select("id, action, note, created_at").eq("target_type", "need").eq("target_id", need.id).order("created_at", { ascending: false }),
    supabase.from("needs").select("id", { count: "exact", head: true }).eq("requester_id", need.requester_id),
    supabase.rpc("staff_evidence_in_scope", { p_need_id: id }),
  ]);
  const money = (m: number | null) => (m == null ? "—" : formatMoney({ amountMinor: m, currency: need.currency }, { list: currencies }));
  const own = need.requester_id === viewer.id;

  return (
    <>
      <div>
        <Link href="/admin/needs" className="text-sm font-semibold text-navy-900 hover:underline">← Moderation queue</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2"><NeedStatusBadge status={need.status} />{need.evidence_reviewed_at && <Badge tone="success">Evidence reviewed</Badge>}</div>
        <h1 className="mt-2 text-2xl font-extrabold">{need.title}</h1>
      </div>
      {typeof sp.done === "string" && <Alert tone="success" live>Action recorded: {sp.done.replace(/_/g, " ")}. The requester has been notified.</Alert>}
      {own && <Alert tone="warning" title="Conflict of interest">This is your own need. Another moderator must review it.</Alert>}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <dl className="card grid gap-5 p-6 sm:grid-cols-2">
            <div><dt className="text-sm text-muted">Category</dt><dd className="font-semibold">{categoryLabel(need.category_slug)}</dd></div>
            <div><dt className="text-sm text-muted">Amount</dt><dd className="font-semibold">{money(need.amount_minor)} <span className="text-muted">({need.currency})</span></dd></div>
            <div><dt className="text-sm text-muted">Accepts</dt><dd>{need.accepted_support_types.map(supportTypeLabel).join(", ")}</dd></div>
            <div><dt className="text-sm text-muted">Region · Deadline</dt><dd>{need.region ?? "—"} · {need.deadline ?? "none"}</dd></div>
            <div><dt className="text-sm text-muted">Visibility</dt><dd>{need.visibility === "public" ? "Public" : "Members only"}{need.show_requester_name ? "" : " · name hidden"}</dd></div>
            <div><dt className="text-sm text-muted">Submitted</dt><dd>{need.submitted_at ? new Date(need.submitted_at).toLocaleString("en-GB") : "—"}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-muted">Description</dt><dd className="mt-1 whitespace-pre-line">{need.description}</dd></div>
            <div className="sm:col-span-2"><dt className="text-sm text-muted">Intended use</dt><dd className="mt-1 whitespace-pre-line">{need.intended_use}</dd></div>
          </dl>

          <section className="card p-6" aria-labelledby="ev">
            <h2 id="ev" className="font-bold">Private evidence</h2>
            {inScope ? (
              <>
                <p className="mb-4 mt-1 text-xs text-muted">Opening a file creates a 2-minute access grant and is recorded in the audit log.</p>
                <EvidenceList files={files} canDelete={false} needId={need.id} />
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                Evidence is only available to moderators while a need is awaiting review, or while a report or verification case about it is open.
              </p>
            )}
          </section>

          <section className="card p-6" aria-labelledby="hist">
            <h2 id="hist" className="font-bold">Moderation history</h2>
            {history?.length ? (
              <ol className="mt-4 space-y-3 text-sm">
                {history.map((h) => (
                  <li key={h.id} className="rounded-xl bg-soft p-3"><strong>{h.action.replace(/_/g, " ")}</strong> · {new Date(h.created_at).toLocaleString("en-GB")}{h.note && <p className="mt-1 text-muted">{h.note}</p>}</li>
                ))}
              </ol>
            ) : <p className="mt-2 text-sm text-muted">No previous actions.</p>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card p-5" aria-labelledby="decide">
            <h2 id="decide" className="mb-4 font-bold">Decision</h2>
            {own ? <p className="text-sm text-muted">Disabled for your own need.</p> : <ModerationForm needId={need.id} actions={actionsFor(need)} />}
          </section>
          <section className="card p-5" aria-labelledby="req">
            <h2 id="req" className="font-bold">Requester</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div><dt className="inline text-muted">Name: </dt><dd className="inline font-semibold">{requester?.display_name}</dd></div>
              <div><dt className="inline text-muted">Member since: </dt><dd className="inline">{requester ? new Date(requester.created_at).toLocaleDateString("en-GB") : "—"}</dd></div>
              <div><dt className="inline text-muted">Identity: </dt><dd className="inline">{requester?.identity_verified_at ? "Verified" : "Not verified"}</dd></div>
              <div><dt className="inline text-muted">Account: </dt><dd className="inline">{requester?.account_status}</dd></div>
              <div><dt className="inline text-muted">Needs created: </dt><dd className="inline">{priorNeeds ?? 0}</dd></div>
            </dl>
            <Link href={`/admin/users?q=${encodeURIComponent(requester?.display_name ?? "")}`} className="mt-3 inline-block text-sm font-semibold underline">Manage account</Link>
          </section>
          <section className="card p-5" aria-labelledby="sig">
            <h2 id="sig" className="font-bold">Risk signals</h2>
            <p className="mt-1 text-xs text-muted">Indicators only. Use your judgement.</p>
            {signals?.length ? (
              <ul className="mt-3 space-y-2">
                {signals.map((s) => (
                  <li key={s.id} className="rounded-xl border border-line p-3 text-sm">
                    <p className="font-semibold">{s.signal.replace(/_/g, " ")}</p>
                    {Array.isArray((s.detail as { categories?: string[] })?.categories) && (
                      <p className="mt-1 text-xs">Detected: {(s.detail as { categories: string[] }).categories.map((c) => c.replace(/_/g, " ")).join(", ")}</p>
                    )}
                    {Array.isArray((s.detail as { matches?: string[] })?.matches) && (
                      <p className="mt-1 text-xs">Matches: {(s.detail as { matches: string[] }).matches.map((m) => <Link key={m} href={`/admin/needs/${m}`} className="mr-2 underline">{m.slice(0, 8)}</Link>)}</p>
                    )}
                    {s.reviewed_at ? <p className="mt-1 text-xs text-muted">Reviewed</p> : (
                      <form action={reviewSignalAction} className="mt-2"><input type="hidden" name="signalId" value={s.id} /><button className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold">Mark reviewed</button></form>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">None.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
