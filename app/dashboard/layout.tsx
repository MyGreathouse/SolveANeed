import Link from "next/link";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ACCOUNT_NAV, DEALS_NAV, REQUESTER_NAV, SUPPORTER_NAV, sectionsFor } from "@/components/dashboard/nav-config";
import { SideNav } from "@/components/dashboard/SideNav";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const viewer = await requireViewer("/dashboard");
  const s = sectionsFor(viewer.roles);
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .is("read_at", null);

  const groups = [
    ...(s.requester ? [{ title: "Requester", items: REQUESTER_NAV }] : []),
    ...(s.supporter ? [{ title: "Supporter", items: SUPPORTER_NAV }] : []),
    { title: "Offers and agreements", items: DEALS_NAV },
    { title: "Account", items: ACCOUNT_NAV },
  ];

  return (
    <div className="flex-1 bg-soft">
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[15rem_1fr] lg:py-10">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="mb-5 hidden rounded-2xl bg-navy-900 p-4 text-white lg:block on-navy">
            <p className="text-xs text-on-navy-muted">Signed in as</p>
            <p className="truncate font-semibold">{viewer.displayName}</p>
            {s.staff && (
              <Link href="/admin" className="mt-3 inline-flex min-h-9 items-center rounded-full bg-gold-500 px-3 text-xs font-bold text-navy-900">
                Open admin console
              </Link>
            )}
          </div>
          <SideNav groups={groups} unread={count ?? 0} />
          {s.staff && (
            <Link href="/admin" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-gold-500 text-sm font-bold text-navy-900 lg:hidden">
              Admin console
            </Link>
          )}
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
