import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth/session";
import { getCurrencies, listSavedNeeds } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { NeedCard } from "@/components/needs/NeedCard";

export const metadata: Metadata = { title: "Saved Needs" };

export default async function SavedPage() {
  const viewer = await requireViewer("/dashboard/supporter/saved");
  const [needs, currencies] = await Promise.all([listSavedNeeds(viewer.id), getCurrencies()]);
  return (
    <>
      <PageHeader title="Saved needs" description="Needs you've saved to come back to. Closed or removed needs drop off automatically." />
      {needs.length ? (
        <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">{needs.map((n) => <li key={n.id}><NeedCard need={n} currencies={currencies} /></li>)}</ul>
      ) : (
        <EmptyState title="Nothing saved yet" description="Use “Save this need” on any need page to keep it here." action={<ButtonLink href="/needs" variant="navy">Explore needs</ButtonLink>} />
      )}
    </>
  );
}
