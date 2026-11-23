import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies, getPublicNeed, currencyFor } from "@/lib/data/needs";
import { getMyOpenOfferForNeed } from "@/lib/data/deals";
import { uuidSchema } from "@/lib/domain/validation";
import type { SupportType } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/money";
import { OfferForm } from "@/components/deals/OfferForm";

export const metadata: Metadata = { title: "Make an offer", robots: { index: false } };

export default async function MakeOfferPage({ params }: PageProps<"/needs/[id]/offer">) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const viewer = await requireRole(["supporter"], { next: `/needs/${id}/offer` });
  const [need, currencies] = await Promise.all([getPublicNeed(id), getCurrencies()]);
  if (!need) notFound();
  const existing = await getMyOpenOfferForNeed(viewer.id, need.id);
  if (existing) redirect(`/dashboard/offers/${existing}`);
  const supabase = await createClient();
  const { data: paidOpen } = await supabase.rpc("need_accepts_paid_tasks", { p_need_id: need.id });
  const info = currencyFor(need.currency, currencies);
  const symbol = formatMoney({ amountMinor: 0, currency: need.currency }, { list: currencies }).replace(/[\d.,\s]/g, "") || need.currency;

  return (
    <main className="bg-soft pb-20">
      <div className="container-page max-w-3xl py-8">
        <Link href={`/needs/${need.id}`} className="text-sm font-semibold text-navy-900 hover:underline">← Back to the need</Link>
        <h1 className="mt-3 text-3xl font-extrabold">Make an offer</h1>
        <p className="mt-2 text-muted">
          For <strong className="text-navy-900">{need.title}</strong> · {formatMoney({ amountMinor: need.amount_minor, currency: need.currency }, { list: currencies })} requested in {info.code}.
        </p>
        <div className="card mt-6 p-6 md:p-8">
          <OfferForm
            mode="create"
            needId={need.id}
            allowedTypes={need.accepted_support_types as SupportType[]}
            paidTasksOpen={paidOpen === true}
            currency={{ code: info.code, symbol }}
          />
        </div>
      </div>
    </main>
  );
}
