import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listMyOffers } from "@/lib/data/deals";
import { getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { OffersList } from "@/components/deals/OffersList";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Offers Made" };

export default async function Page() {
  const viewer = await requireRole(["supporter"], { next: "/dashboard/supporter/offers" });
  const [offers, currencies] = await Promise.all([listMyOffers(viewer.id, "made"), getCurrencies()]);
  return (
    <>
      <PageHeader title="Offers Made" description="Offers you have made, their negotiation history and any agreements they became." />
      <OffersList
        offers={offers}
        currencies={currencies}
        viewerId={viewer.id}
        empty={{
          title: "You haven't made any offers",
          description: "Find a published need and choose how you'd like to help.",
          action: <ButtonLink href="/needs" variant="gold">Explore needs</ButtonLink>,
        }}
      />
    </>
  );
}
