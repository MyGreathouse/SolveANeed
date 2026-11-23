import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { SideNav } from "@/components/dashboard/SideNav";

export const metadata: Metadata = { title: { default: "Admin console", template: "%s · Admin · SolveANeed" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { viewer, isAdmin } = await requireStaff();
  const groups = [
    {
      title: "Moderation",
      items: [
        { href: "/admin", label: "Overview" },
        { href: "/admin/needs", label: "Needs" },
        { href: "/admin/reports", label: "Reports" },
        { href: "/admin/disputes", label: "Disputes & safety" },
        { href: "/admin/users", label: "Users" },
        ...(isAdmin ? [{ href: "/admin/audit", label: "Audit Logs" }] : []),
      ],
    },
    { title: "Account", items: [{ href: "/dashboard", label: "Back to dashboard" }] },
  ];

  return (
    <div className="flex-1 bg-soft">
      <div className="border-b border-gold-500/40 bg-navy-950 on-navy">
        <div className="container-page flex min-h-12 items-center justify-between text-sm text-white">
          <span><strong className="text-gold-500">Admin console</strong> · {viewer.displayName} ({viewer.roles.filter((r) => r === "admin" || r === "moderator").join(", ")}) · <span className="text-on-navy-muted">MFA verified</span></span>
          <Link href="/dashboard" className="underline">Exit</Link>
        </div>
      </div>
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[14rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start"><SideNav groups={groups} unread={0} /></aside>
        <main className="min-w-0 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
