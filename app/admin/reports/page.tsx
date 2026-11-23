import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { resolveReportAction } from "../actions";

export const metadata: Metadata = { title: "Reports" };

export default async function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  await requireStaff();
  const sp = await searchParams;
  const closed = sp.view === "closed";
  const supabase = await createClient();
  const { data } = await supabase
    .from("reports")
    .select("id, target_type, target_id, reason, details, status, resolution, created_at")
    .in("status", closed ? ["actioned", "dismissed"] : ["open", "under_review"])
    .order("created_at", { ascending: !closed })
    .limit(100);
  return (
    <>
      <PageHeader title="Reports" actions={<Link href={closed ? "/admin/reports" : "/admin/reports?view=closed"} className="font-semibold underline">{closed ? "View open reports" : "View closed reports"}</Link>} />
      {data?.length ? (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={r.status === "open" ? "warning" : r.status === "under_review" ? "info" : "neutral"}>{r.status.replace("_", " ")}</Badge>
                <span className="font-semibold text-navy-900">{r.reason.replace(/_/g, " ")}</span>
                <span className="text-xs text-muted">on {r.target_type} · {new Date(r.created_at).toLocaleString("en-GB")}</span>
              </div>
              {r.details && <p className="text-sm">{r.details}</p>}
              {r.target_type === "need" && <Link href={`/admin/needs/${r.target_id}`} className="text-sm font-semibold underline">Review the reported need</Link>}
              {r.target_type === "offer" && <Link href={`/admin/cases/${r.target_id}`} className="text-sm font-semibold underline">Open the case</Link>}
              {r.target_type === "message" && <Link href={`/admin/cases/by-message/${r.target_id}`} className="text-sm font-semibold underline">Open the case</Link>}
              {r.resolution && <p className="text-sm text-muted">Resolution: {r.resolution}</p>}
              {!closed && (
                <form action={resolveReportAction} className="flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="reportId" value={r.id} />
                  <label htmlFor={`res-${r.id}`} className="sr-only">Resolution note</label>
                  <input id={`res-${r.id}`} name="resolution" placeholder="Resolution note" className="field-input min-h-10 py-1.5 text-sm" maxLength={1000} />
                  {r.status === "open" && <button name="status" value="under_review" className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold">Start review</button>}
                  <button name="status" value="actioned" className="min-h-10 rounded-full bg-teal-700 px-4 text-sm font-semibold text-white">Actioned</button>
                  <button name="status" value="dismissed" className="min-h-10 rounded-full border border-line px-4 text-sm font-semibold">Dismiss</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title={closed ? "No closed reports" : "No open reports"} description="Reports from members will appear here." />
      )}
    </>
  );
}
