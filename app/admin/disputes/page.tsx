import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { reviewSignalAction } from "../actions";

export const metadata: Metadata = { title: "Disputes & safety" };

const FLAG_LABEL: Record<string, string> = {
  email_address: "Email address", phone_number: "Phone number", off_platform_contact: "Off-platform contact",
  off_platform_payment: "Off-platform payment",
};

export default async function DisputesPage() {
  await requireStaff();
  const supabase = await createClient();
  const [disputes, signals] = await Promise.all([
    supabase.from("disputes").select("id, agreement_id, status, opened_at, agreements(offer_id, agreement_type, test_mode)")
      .in("status", ["open", "under_review"]).order("opened_at", { ascending: true }).limit(100),
    supabase.from("risk_signals").select("id, entity_type, entity_id, detail, created_at")
      .in("entity_type", ["message", "offer", "agreement"]).is("reviewed_at", null).order("created_at", { ascending: true }).limit(100),
  ]);
  const signalOffers = await Promise.all((signals.data ?? []).map(async (s) => {
    if (s.entity_type === "offer") return s.entity_id;
    if (s.entity_type === "message") return (await supabase.rpc("staff_offer_for_message", { p_message_id: s.entity_id })).data as string | null;
    const { data } = await supabase.from("agreements").select("offer_id").eq("id", s.entity_id).maybeSingle();
    return data?.offer_id ?? null;
  }));

  return (
    <>
      <PageHeader title="Disputes & safety" description="Open disputes and flagged offers, agreements and messages. Opening a conversation is audit-logged." />
      <section aria-labelledby="d-h">
        <h2 id="d-h" className="mb-3 text-lg font-bold">Open disputes</h2>
        {disputes.data?.length ? (
          <ul className="space-y-3">
            {disputes.data.map((d) => {
              const ag = d.agreements as unknown as { offer_id: string; agreement_type: string; test_mode: boolean } | null;
              return (
                <li key={d.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy-900">{ag?.agreement_type.replace("_", " ")} agreement {ag?.test_mode && <Badge tone="warning">test</Badge>}</p>
                    <p className="text-xs text-muted">Opened {new Date(d.opened_at).toLocaleString("en-GB")}</p>
                  </div>
                  {ag && <Link href={`/admin/cases/${ag.offer_id}`} className="font-semibold underline">Review case</Link>}
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="No open disputes" description="Disputes opened by members appear here." />}
      </section>
      <section aria-labelledby="s-h">
        <h2 id="s-h" className="mb-3 text-lg font-bold">Flagged content</h2>
        {signals.data?.length ? (
          <ul className="space-y-3">
            {signals.data.map((s, i) => {
              const flags = ((s.detail as { flags?: string[] })?.flags ?? []).map((f) => FLAG_LABEL[f] ?? f);
              return (
                <li key={s.id} className="card flex flex-wrap items-center justify-between gap-3 p-5">
                  <div>
                    <p className="font-semibold text-navy-900">Flagged {s.entity_type}</p>
                    <p className="text-sm text-muted">{flags.join(", ")} · {new Date(s.created_at).toLocaleString("en-GB")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {signalOffers[i] && <Link href={`/admin/cases/${signalOffers[i]}`} className="font-semibold underline">Review case</Link>}
                    <form action={reviewSignalAction}>
                      <input type="hidden" name="signalId" value={s.id} />
                      <SubmitButton variant="outline" size="sm" pendingLabel="Saving…">Mark reviewed</SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="Nothing flagged" description="Offers, agreements and messages with contact or off-platform payment details appear here." />}
      </section>
    </>
  );
}
