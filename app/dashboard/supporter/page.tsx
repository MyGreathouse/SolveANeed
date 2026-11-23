import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getCurrencies, listPublishedNeeds } from "@/lib/data/needs";
import { getPreferences } from "@/lib/data/preferences";
import { rankNeeds } from "@/lib/domain/matching";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { NeedCard } from "@/components/needs/NeedCard";

export const metadata: Metadata = { title: "Discover Needs" };

export default async function SupporterDiscover({ searchParams }: PageProps<"/dashboard/supporter">) {
  const sp = await searchParams;
  const viewer = await requireRole(["supporter"], { next: "/dashboard/supporter" });
  const [{ needs }, prefs, currencies] = await Promise.all([listPublishedNeeds({}, { limit: 60 }), getPreferences(viewer.id), getCurrencies()]);
  const ranked = rankNeeds(needs, {
    userId: viewer.id,
    categories: prefs?.categories ?? [],
    supportTypes: prefs?.support_types ?? [],
    regions: prefs?.regions ?? [],
    currency: prefs?.currency ?? null,
    maxAmountMinor: prefs?.max_amount_minor ?? null,
  });

  return (
    <>
      <PageHeader
        eyebrow="Supporter"
        title="Discover needs"
        description={prefs ? "Ranked by your preferences. Each card explains why it matched." : "Set your preferences to see the needs that best match how you'd like to help."}
        actions={
          <>
            <ButtonLink href="/dashboard/supporter/preferences" variant="outline">{prefs ? "Edit preferences" : "Set preferences"}</ButtonLink>
            <ButtonLink href="/needs" variant="navy">Browse all with filters</ButtonLink>
          </>
        }
      />
      {sp.notice === "preferences-saved" && <Alert tone="success" live className="mb-6">Preferences saved. Your matches have been updated.</Alert>}
      {ranked.length ? (
        <ul className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {ranked.map(({ need, reasons }) => (
            <li key={need.id} className="flex flex-col gap-2">
              <NeedCard need={need} currencies={currencies} />
              {reasons.length > 0 && (
                <p className="px-2 text-xs text-muted"><span className="font-semibold text-teal-700">Why this matched:</span> {reasons.join(" · ")}</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No matching needs right now"
          description="There are no published needs that match your preferences yet. Try widening your preferences, or check back soon."
          action={<ButtonLink href="/dashboard/supporter/preferences" variant="navy">Adjust preferences</ButtonLink>}
        />
      )}
    </>
  );
}
