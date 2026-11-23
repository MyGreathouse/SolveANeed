import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Audit Logs" };

export default async function AuditPage() {
  await requireStaff({ adminOnly: true });
  const supabase = await createClient();
  const { data } = await supabase.from("audit_events").select("id, actor_id, action, entity_type, entity_id, metadata, created_at").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <PageHeader title="Audit logs" description="Append-only record of sensitive actions. Showing the latest 200 events." />
      {data?.length ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Audit events</caption>
            <thead className="border-b border-line text-muted"><tr><th scope="col" className="p-3">When</th><th scope="col" className="p-3">Action</th><th scope="col" className="p-3">Entity</th><th scope="col" className="p-3">Actor</th><th scope="col" className="p-3">Details</th></tr></thead>
            <tbody className="divide-y divide-line font-mono text-xs">
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-3">{new Date(e.created_at).toLocaleString("en-GB")}</td>
                  <td className="p-3 font-semibold">{e.action}</td>
                  <td className="p-3">{e.entity_type}{e.entity_id ? ` · ${String(e.entity_id).slice(0, 8)}` : ""}</td>
                  <td className="p-3">{e.actor_id ? String(e.actor_id).slice(0, 8) : "system"}</td>
                  <td className="max-w-xs truncate p-3">{JSON.stringify(e.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No audit events yet" description="Sensitive actions will be recorded here." />
      )}
    </>
  );
}
