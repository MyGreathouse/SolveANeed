import type { Metadata } from "next";
import Link from "next/link";
import { NeedCard } from "@/components/needs/NeedCard";
import { ExploreFilters } from "@/components/needs/ExploreFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { exploreFiltersSchema } from "@/lib/domain/validation";
import { PAGE_SIZE, getCurrencies, listPublishedNeeds } from "@/lib/data/needs";

export const metadata: Metadata = { title: "Explore Needs", description: "Browse genuine needs reviewed by the SolveANeed moderation team." };

function pageHref(sp: Record<string, string | string[] | undefined>, page: number) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v && k !== "page") p.set(k, v);
  if (page > 1) p.set("page", String(page));
  const s = p.toString();
  return `/needs${s ? `?${s}` : ""}`;
}

export default async function ExplorePage({ searchParams }: PageProps<"/needs">) {
  const sp = await searchParams;
  const filters = exploreFiltersSchema.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v || undefined])));
  const [{ needs, total, page, available }, currencies] = await Promise.all([listPublishedNeeds(filters), getCurrencies()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(filters).some((v) => v !== undefined && v !== 1);

  return (
    <main className="bg-soft pb-20">
      <div className="bg-navy-900 on-navy">
        <div className="container-page py-12 md:py-16">
          <p className="eyebrow">Explore needs</p>
          <h1 className="mt-2 text-4xl font-extrabold text-white md:text-5xl">Find a need you can help solve</h1>
          <p className="mt-3 max-w-2xl text-lg text-on-navy-muted">Every listing has been reviewed by a moderator. Sign in to save needs and, once available, make offers.</p>
        </div>
      </div>
      <div className="container-page mt-10 grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside><ExploreFilters filters={filters} currencies={currencies} /></aside>
        <section aria-labelledby="results-title">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="results-title" className="text-lg font-bold" aria-live="polite">
              {total === 1 ? "1 need" : `${total} needs`}{filtered ? " match your filters" : ""}
            </h2>
          </div>
          {needs.length ? (
            <>
              <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {needs.map((n) => <li key={n.id}><NeedCard need={n} currencies={currencies} /></li>)}
              </ul>
              {pages > 1 && (
                <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-3">
                  {page > 1 && <Link href={pageHref(sp, page - 1)} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-5 font-semibold">Previous</Link>}
                  <span className="text-sm text-muted">Page {page} of {pages}</span>
                  {page < pages && <Link href={pageHref(sp, page + 1)} className="inline-flex min-h-11 items-center rounded-full border border-line bg-white px-5 font-semibold">Next</Link>}
                </nav>
              )}
            </>
          ) : (
            <EmptyState
              title={filtered ? "No needs match these filters" : "No published needs yet"}
              description={
                filtered
                  ? "Try removing a filter or widening the amount range."
                  : available
                    ? "SolveANeed is just getting started. Real needs will appear here as soon as they pass review — we never show placeholder examples."
                    : "Listings are temporarily unavailable. Please try again shortly."
              }
              action={filtered ? <ButtonLink href="/needs" variant="navy">Clear filters</ButtonLink> : <ButtonLink href="/get-started?path=need" variant="gold">Post a need</ButtonLink>}
            />
          )}
        </section>
      </div>
    </main>
  );
}
