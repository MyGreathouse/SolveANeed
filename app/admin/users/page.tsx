import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/staff";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { AccountStatusForm } from "@/components/dashboard/AccountStatusForm";
import { setStaffRoleAction } from "../actions";

export const metadata: Metadata = { title: "Users" };

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin/users">) {
  const { viewer, isAdmin } = await requireStaff();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.replace(/[%_,()]/g, " ").trim().slice(0, 60) : "";
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, display_name, account_status, created_at, identity_verified_at").order("created_at", { ascending: false }).limit(50);
  if (q) query = query.ilike("display_name", `%${q}%`);
  if (sp.status === "suspended") query = query.eq("account_status", "suspended");
  const { data: profiles } = await query;
  const ids = (profiles ?? []).map((p) => p.id);
  const { data: roles } = ids.length ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids) : { data: [] };
  const rolesFor = (id: string) => (roles ?? []).filter((r) => r.user_id === id).map((r) => r.role as string);

  return (
    <>
      <PageHeader title="Users" description="Email addresses are deliberately not shown here." />
      <form method="get" className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Search by display name</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by display name" className="field-input max-w-sm" />
        <button className="min-h-11 rounded-full bg-navy-900 px-5 font-semibold text-white">Search</button>
      </form>
      {profiles?.length ? (
        <ul className="space-y-3">
          {profiles.map((p) => {
            const r = rolesFor(p.id);
            return (
              <li key={p.id} className="card space-y-3 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-navy-900">{p.display_name}</p>
                  {r.map((x) => <Badge key={x} tone={x === "admin" || x === "moderator" ? "navy" : "neutral"}>{x}</Badge>)}
                  {p.account_status !== "active" && <Badge tone="danger">{p.account_status.replace("_", " ")}</Badge>}
                  {p.identity_verified_at && <Badge tone="info">ID verified</Badge>}
                  <span className="text-xs text-muted">Joined {new Date(p.created_at).toLocaleDateString("en-GB")}</span>
                </div>
                {p.id !== viewer.id && p.account_status !== "deletion_requested" && <AccountStatusForm userId={p.id} status={p.account_status} />}
                {isAdmin && p.id !== viewer.id && (
                  <div className="flex flex-wrap gap-2">
                    {(["moderator", "admin"] as const).map((role) => {
                      const on = r.includes(role);
                      return (
                        <form key={role} action={setStaffRoleAction}>
                          <input type="hidden" name="userId" value={p.id} />
                          <input type="hidden" name="role" value={role} />
                          <input type="hidden" name="enabled" value={String(!on)} />
                          <button className="min-h-9 rounded-full border border-line px-3 text-xs font-semibold">{on ? `Remove ${role}` : `Make ${role}`}</button>
                        </form>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No users found" description="Try a different search." />
      )}
    </>
  );
}
