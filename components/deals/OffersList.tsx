import Link from "next/link";
import type { OfferListItem } from "@/lib/data/deals";
import { supportTypeLabel } from "@/lib/domain/catalog";
import { formatMoney, type CurrencyInfo } from "@/lib/money";
import type { OfferStatus } from "@/lib/domain/offer-status";
import { EmptyState } from "@/components/ui/EmptyState";
import { OfferStatusBadge } from "./StatusBadges";

export function OffersList({
  offers,
  currencies,
  viewerId,
  empty,
}: {
  offers: OfferListItem[];
  currencies: CurrencyInfo[];
  viewerId: string;
  empty: { title: string; description: string; action?: React.ReactNode };
}) {
  if (!offers.length) return <EmptyState title={empty.title} description={empty.description} action={empty.action} />;
  return (
    <ul className="space-y-3">
      {offers.map((o) => {
        const yourTurn = (o.status === "proposed" || o.status === "countered") && o.last_proposed_by !== viewerId;
        return (
          <li key={o.id}>
            <Link href={`/dashboard/offers/${o.id}`} className="card flex flex-col gap-3 p-5 hover:border-navy-900/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy-900">{o.need_title}</p>
                <p className="mt-1 text-sm text-muted">
                  {supportTypeLabel(o.offer_type)}
                  {o.offer_type !== "direct_support" && <> · {formatMoney({ amountMinor: o.amount_minor, currency: o.currency }, { list: currencies })}</>}
                  {" "}· version {o.current_version}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {yourTurn && <span className="rounded-full bg-gold-500 px-2.5 py-0.5 text-xs font-bold text-navy-900">Your response needed</span>}
                <OfferStatusBadge status={o.status as OfferStatus} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
