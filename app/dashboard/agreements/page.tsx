import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth/session";
import { listMyAgreements } from "@/lib/data/deals";
import { getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgreementsList } from "@/components/deals/AgreementsList";

export const metadata: Metadata = { title: "Agreements" };

export default async function AgreementsPage() {
  const viewer = await requireViewer("/dashboard/agreements");
  const [items, currencies] = await Promise.all([listMyAgreements(viewer.id), getCurrencies()]);
  return (
    <>
      <PageHeader
        title="Agreements"
        description="Accepted offers become agreements with locked terms. None are funded yet: payments are not available on SolveANeed."
      />
      <AgreementsList items={items} currencies={currencies} viewerId={viewer.id} emptyText="When an offer is accepted, its agreement appears here." />
    </>
  );
}
