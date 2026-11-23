import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { NeedStatusBadge } from "@/components/needs/NeedStatusBadge";
import { NEED_STATUSES, NEED_STATUS_LABEL, type NeedStatus } from "@/lib/domain/need-status";
import { categoryLabel } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/money";
import { getCurrencies } from "@/lib/data/needs";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Needs" };

export default async function AdminNeedsPage({ searchParams }: PageProps<"/admin/needs">) {
  await requireStaff();
  const sp = await searchParams;
  const status: NeedStatus = NEED_STATUSES.find((s) => s === sp.status) ?? "pending_review";
  const supabase = await createClient();
  const currencies = await getCurrencies();

  let ids: string[] | null = null;
  if (sp.signals === "1") {
    const { data: sig } = await supabase.from("risk_signals").select("entity_id").eq("entity_type", "need").is("reviewed_at", null);
    ids = [...new Set((sig ?? []).map((s) => s.entity_id))];
  }
  let q = supabase
    .from("needs")
    .select("id, title, category_slug, amount_minor, currency, status, submitted_at, updated_at")
    .order(status === "pending_review" ? "submitted_at" : "updated_at", { ascending: status === "pending_review" })
    .limit(100);
  q = ids ? q.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]) : q.eq("status", status);
  const { data } = await q;
  const needs = data ?? [];

  return (
    <>
      <PageHeader title="Needs" description={ids ? "Needs with unreviewed risk signals." : status === "pending_review" ? "Oldest submissions first." : undefined} />
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {NEED_STATUSES.filter((s) => s !== "draft").map((s) => (
          <Link key={s} href={`/admin/needs?status=${s}`} aria-current={!ids && status === s ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm", !ids && status === s ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white")}>
            {NEED_STATUS_LABEL[s]}
          </Link>
        ))}
        <Link href="/admin/needs?signals=1" aria-current={ids ? "page" : undefined} className={cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm", ids ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white")}>Risk signals</Link>
      </nav>
      {needs.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Needs</caption>
            <thead className="border-b border-line text-muted"><tr><th scope="col" className="p-4">Need</th><th scope="col" className="p-4">Status</th><th scope="col" className="p-4">Amount</th><th scope="col" className="p-4">Submitted</th></tr></thead>
            <tbody className="divide-y divide-line">
              {needs.map((n) => (
                <tr key={n.id}>
                  <td className="p-4"><Link href={`/admin/needs/${n.id}`} className="font-semibold text-navy-900 underline">{n.title}</Link><span className="block text-xs text-muted">{categoryLabel(n.category_slug)}</span></td>
                  <td className="p-4"><NeedStatusBadge status={n.status} /></td>
                  <td className="p-4">{n.amount_minor != null ? formatMoney({ amountMinor: n.amount_minor, currency: n.currency }, { list: currencies }) : "—"}</td>
                  <td className="p-4 text-muted">{n.submitted_at ? new Date(n.submitted_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="Queue is clear" description="There are no needs in this view." />
      )}
    </>
  );
}
