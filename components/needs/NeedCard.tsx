import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PublicNeed } from "@/lib/data/needs";
import { categoryLabel, supportTypeLabel } from "@/lib/domain/catalog";
import { formatMoney, type CurrencyInfo } from "@/lib/money";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Badge } from "@/components/ui/Badge";
import { BadgeCheck, FileCheck2 } from "@/components/ui/icons";

export function NeedCard({ need, currencies }: { need: PublicNeed; currencies: CurrencyInfo[] }) {
  const target = formatMoney({ amountMinor: need.amount_minor, currency: need.currency }, { list: currencies });
  const funded = formatMoney({ amountMinor: need.funded_minor, currency: need.currency }, { list: currencies });
  const pct = Math.floor(need.funding_basis_points / 100);
  return (
    <article className="card group relative flex h-full flex-col p-5 transition-shadow hover:shadow-[var(--shadow-lift)]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">{categoryLabel(need.category_slug)}</Badge>
        {need.evidence_reviewed && (
          <Badge tone="success"><FileCheck2 className="size-3.5" aria-hidden="true" />Evidence reviewed</Badge>
        )}
        {need.requester_identity_verified && (
          <Badge tone="info"><BadgeCheck className="size-3.5" aria-hidden="true" />ID verified</Badge>
        )}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-snug">
        <Link href={`/needs/${need.id}`} className="after:absolute after:inset-0 after:rounded-[var(--radius-card)]">
          {need.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-3 text-sm text-muted">{need.description}</p>
      <div className="mt-auto pt-5">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="font-bold text-navy-900">{target} needed</span>
          <span className="text-muted">{pct}% supported</span>
        </div>
        <ProgressBar basisPoints={need.funding_basis_points} label={`${funded} of ${target} supported`} className="mt-2" />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            {need.region ? (<><MapPin className="size-3.5" aria-hidden="true" />{need.region}</>) : "UK"}
          </span>
          <span>Accepts: {need.accepted_support_types.map(supportTypeLabel).join(" · ")}</span>
        </div>
      </div>
    </article>
  );
}
