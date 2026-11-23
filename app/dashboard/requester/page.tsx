import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { listMyNeeds, getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { NeedStatusBadge } from "@/components/needs/NeedStatusBadge";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Requester overview" };

export default async function RequesterOverview() {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester" });
  const [needs, currencies] = await Promise.all([listMyNeeds(viewer.id), getCurrencies()]);
  const count = (s: string[]) => needs.filter((n) => s.includes(n.status)).length;
  const stats = [
    { label: "Drafts", value: count(["draft"]), href: "/dashboard/requester/needs?status=draft" },
    { label: "Awaiting review", value: count(["pending_review"]), href: "/dashboard/requester/needs?status=pending_review" },
    { label: "Needs changes", value: count(["changes_requested"]), href: "/dashboard/requester/needs?status=changes_requested" },
    { label: "Live", value: count(["published"]), href: "/dashboard/requester/needs?status=published" },
  ];
  const attention = needs.filter((n) => n.status === "changes_requested" || n.status === "draft").slice(0, 3);

  return (
    <>
      <PageHeader
        eyebrow="Requester"
        title={`Welcome, ${viewer.displayName}`}
        description="Track your needs from draft to review to live."
        actions={<ButtonLink href="/dashboard/requester/needs/new" variant="gold">Create a need</ButtonLink>}
      />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="card block p-5 hover:shadow-[var(--shadow-lift)]">
              <span className="block text-3xl font-extrabold text-navy-900">{s.value}</span>
              <span className="text-sm text-muted">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10" aria-labelledby="attention">
        <h2 id="attention" className="text-lg font-bold">Needs your attention</h2>
        {attention.length ? (
          <ul className="mt-4 space-y-3">
            {attention.map((n) => (
              <li key={n.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <NeedStatusBadge status={n.status} />
                  <p className="mt-2 font-semibold text-navy-900">{n.title}</p>
                  {n.moderation_note && <p className="mt-1 text-sm text-warning-700">Moderator: {n.moderation_note}</p>}
                  {n.amount_minor != null && <p className="text-sm text-muted">{formatMoney({ amountMinor: n.amount_minor, currency: n.currency }, { list: currencies })}</p>}
                </div>
                <ButtonLink href={`/dashboard/requester/needs/${n.id}`} variant="navy" size="sm">{n.status === "draft" ? "Continue" : "Update"}</ButtonLink>
              </li>
            ))}
          </ul>
        ) : needs.length === 0 ? (
          <EmptyState
            className="mt-4"
            title="You haven't posted a need yet"
            description="Describe what you need and how it will be used. You can save a draft and come back at any time."
            action={<ButtonLink href="/dashboard/requester/needs/new" variant="gold">Create your first need</ButtonLink>}
          />
        ) : (
          <p className="mt-4 text-muted">Nothing needs your attention right now.</p>
        )}
      </section>
    </>
  );
}
