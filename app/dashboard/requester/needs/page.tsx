import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { getCurrencies, listMyNeeds } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { NeedStatusBadge } from "@/components/needs/NeedStatusBadge";
import { NEED_STATUSES, NEED_STATUS_LABEL } from "@/lib/domain/need-status";
import { categoryLabel } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "My Needs" };

export default async function MyNeedsPage({ searchParams }: PageProps<"/dashboard/requester/needs">) {
  const sp = await searchParams;
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/needs" });
  const [all, currencies] = await Promise.all([listMyNeeds(viewer.id), getCurrencies()]);
  const status = NEED_STATUSES.find((s) => s === sp.status);
  const needs = status ? all.filter((n) => n.status === status) : all;

  return (
    <>
      <PageHeader title="My Needs" actions={<ButtonLink href="/dashboard/requester/needs/new" variant="gold">Create a need</ButtonLink>} />
      {sp.notice === "deleted" && <Alert tone="success" live className="mb-6">Draft deleted.</Alert>}
      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        {[undefined, ...NEED_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/dashboard/requester/needs?status=${s}` : "/dashboard/requester/needs"}
            aria-current={status === s ? "page" : undefined}
            className={cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium", status === s ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-navy-900")}
          >
            {s ? NEED_STATUS_LABEL[s] : "All"}
          </Link>
        ))}
      </nav>
      {needs.length ? (
        <ul className="space-y-3">
          {needs.map((n) => (
            <li key={n.id}>
              <Link href={`/dashboard/requester/needs/${n.id}`} className="card flex flex-col gap-2 p-5 hover:shadow-[var(--shadow-lift)] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NeedStatusBadge status={n.status} />
                    <span className="text-xs text-muted">{categoryLabel(n.category_slug)}</span>
                  </div>
                  <p className="mt-2 truncate font-semibold text-navy-900">{n.title}</p>
                  <p className="text-xs text-muted">Updated {new Date(n.updated_at).toLocaleDateString("en-GB")}</p>
                </div>
                <span className="shrink-0 font-bold text-navy-900">
                  {n.amount_minor != null ? formatMoney({ amountMinor: n.amount_minor, currency: n.currency }, { list: currencies }) : "Amount not set"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={status ? `No needs with status “${NEED_STATUS_LABEL[status]}”` : "No needs yet"}
          description="When you create a need it will appear here, along with its review status."
          action={<ButtonLink href="/dashboard/requester/needs/new" variant="gold">Create a need</ButtonLink>}
        />
      )}
    </>
  );
}
