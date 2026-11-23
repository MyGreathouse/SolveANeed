import Link from "next/link";
import { Section } from "./Section";
import { NeedCard } from "@/components/needs/NeedCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CATEGORIES } from "@/lib/domain/catalog";
import { getCurrencies, listPublishedNeeds } from "@/lib/data/needs";

export async function ExploreNeeds() {
  const [{ needs, available }, currencies] = await Promise.all([listPublishedNeeds({}, { limit: 6 }), getCurrencies()]);
  return (
    <Section
      id="explore"
      eyebrow="Explore needs"
      title="Real needs, reviewed by people."
      intro="Every need you see here has been checked by our moderation team before publication."
    >
      <nav aria-label="Browse by category" className="-mx-1 mb-8 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/needs?category=${c.slug}`}
            className="inline-flex min-h-10 items-center rounded-full border border-line bg-white px-4 text-sm font-medium text-navy-900 hover:border-navy-900"
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {needs.length > 0 ? (
        <>
          <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {needs.map((n) => (
              <li key={n.id}>
                <NeedCard need={n} currencies={currencies} />
              </li>
            ))}
          </ul>
          <div className="mt-10 text-center">
            <ButtonLink href="/needs" variant="navy" size="lg">Explore all needs</ButtonLink>
          </div>
        </>
      ) : (
        <EmptyState
          title={available ? "The first needs are on their way" : "Listings will appear here soon"}
          description={
            <p>
              SolveANeed is just getting started, so there are no published needs yet. We will never show made-up examples — when real needs pass review, they&apos;ll appear here.
            </p>
          }
          action={
            <>
              <ButtonLink href="/get-started?path=need" variant="gold">Post the first need</ButtonLink>
              <ButtonLink href="/get-started?path=help" variant="outline">Join as a supporter</ButtonLink>
            </>
          }
        />
      )}
    </Section>
  );
}
