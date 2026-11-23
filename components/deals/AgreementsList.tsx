import Link from "next/link";
import type { AgreementListItem } from "@/lib/data/deals";
import { supportTypeLabel } from "@/lib/domain/catalog";
import type { AgreementStatus } from "@/lib/domain/agreement-status";
import { formatMoney, type CurrencyInfo } from "@/lib/money";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgreementStatusBadge } from "./StatusBadges";

export function AgreementsList({ items, currencies, viewerId, emptyText }: { items: AgreementListItem[]; currencies: CurrencyInfo[]; viewerId: string; emptyText: string }) {
  if (!items.length) return <EmptyState title="Nothing here yet" description={emptyText} />;
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.id}>
          <Link href={`/dashboard/agreements/${a.id}`} className="card flex flex-col gap-3 p-5 hover:border-navy-900/30 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold text-navy-900">{a.need_title}</p>
              <p className="mt-1 text-sm text-muted">
                {supportTypeLabel(a.agreement_type)}
                {a.agreement_type !== "direct_support" && <> · {formatMoney({ amountMinor: a.amount_minor, currency: a.currency }, { list: currencies })}</>}
                {" "}· you are the {a.requester_id === viewerId ? "requester" : "supporter"}
                {a.test_mode && " · test environment"}
              </p>
            </div>
            <AgreementStatusBadge status={a.status as AgreementStatus} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
