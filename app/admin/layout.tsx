import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/staff";
import { Alert } from "@/components/ui/Alert";
import { SideNav } from "@/components/dashboard/SideNav";

export const metadata: Metadata = { title: { default: "Admin console", template: "%s · Admin · SolveANeed" }, robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { viewer, mfaRequired, mfaSatisfied, isAdmin } = await requireStaff();
  const groups = [
    {
      title: "Moderation",
      items: [
        { href: "/admin", label: "Overview" },
        { href: "/admin/needs", label: "Needs" },
        { href: "/admin/reports", label: "Reports" },
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
          <span><strong className="text-gold-500">Admin console</strong> · {viewer.displayName} ({viewer.roles.filter((r) => r === "admin" || r === "moderator").join(", ")})</span>
          <Link href="/dashboard" className="underline">Exit</Link>
        </div>
      </div>
      <div className="container-page grid gap-8 py-8 lg:grid-cols-[14rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start"><SideNav groups={groups} unread={0} /></aside>
        <main className="min-w-0 space-y-6">
          {mfaRequired && !mfaSatisfied ? (
            <Alert tone="danger" title="Multi-factor authentication required">
              Staff must complete multi-factor authentication before using the admin console. Sign out, then sign in again and complete MFA.
            </Alert>
          ) : (
            <>
              {!mfaRequired && (
                <Alert tone="warning" title="Development setting">
                  Staff MFA is not enforced (REQUIRE_STAFF_MFA is off). Enable it before launch.
                </Alert>
              )}
              {children}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
