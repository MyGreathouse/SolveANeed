import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listMyOffers } from "@/lib/data/deals";
import { getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { OffersList } from "@/components/deals/OffersList";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Offers Received" };

export default async function Page() {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/offers" });
  const [offers, currencies] = await Promise.all([listMyOffers(viewer.id, "received"), getCurrencies()]);
  return (
    <>
      <PageHeader title="Offers Received" description="Review, negotiate, accept or decline offers on your needs. Accepting creates an agreement — no money moves yet." />
      <OffersList
        offers={offers}
        currencies={currencies}
        viewerId={viewer.id}
        empty={{
          title: "No offers yet",
          description: "When supporters make offers on your published needs, they will appear here.",
          action: <ButtonLink href="/dashboard/requester/needs" variant="outline">View my needs</ButtonLink>,
        }}
      />
    </>
  );
}
