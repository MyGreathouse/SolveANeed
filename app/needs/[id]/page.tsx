import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bookmark, BookmarkCheck, CalendarDays, FileCheck2, MapPin } from "lucide-react";
import { getCurrencies, getMyNeed, getPublicNeed, isNeedSaved } from "@/lib/data/needs";
import { getViewer } from "@/lib/auth/session";
import { getMyOpenOfferForNeed } from "@/lib/data/deals";
import { uuidSchema } from "@/lib/domain/validation";
import { SUPPORT_TYPES, categoryLabel } from "@/lib/domain/catalog";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ButtonLink } from "@/components/ui/Button";
import { ReportForm } from "@/components/needs/ReportForm";
import { PillarIcon } from "@/components/ui/icons";
import { toggleSaveNeedAction } from "../actions";

async function load(id: string) {
  if (!uuidSchema.safeParse(id).success) return null;
  return getPublicNeed(id);
}

export async function generateMetadata({ params }: PageProps<"/needs/[id]">): Promise<Metadata> {
  const need = await load((await params).id);
  if (!need) return { title: "Need not found" };
  return { title: need.title, description: need.description.slice(0, 160), robots: need.visibility === "members_only" ? { index: false } : undefined };
}

export default async function NeedPage({ params }: PageProps<"/needs/[id]">) {
  const { id } = await params;
  const [need, viewer, currencies] = await Promise.all([load(id), getViewer(), getCurrencies()]);
  if (!need) notFound();
  const [saved, myOffer, own] = viewer
    ? await Promise.all([isNeedSaved(viewer.id, need.id), getMyOpenOfferForNeed(viewer.id, need.id), getMyNeed(viewer.id, need.id)])
    : [false, null, null];
  const money = (m: number) => formatMoney({ amountMinor: m, currency: need.currency }, { list: currencies });
  const pct = Math.floor(need.funding_basis_points / 100);

  return (
    <main className="bg-soft pb-20">
      <div className="container-page pt-8">
        <Link href="/needs" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-navy-900 hover:underline">
          <ArrowLeft className="size-4" aria-hidden="true" /> All needs
        </Link>
      </div>
      <div className="container-page mt-4 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <article className="card p-6 md:p-10">
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{categoryLabel(need.category_slug)}</Badge>
            {need.evidence_reviewed && <Badge tone="success"><FileCheck2 className="size-3.5" aria-hidden="true" />Evidence reviewed</Badge>}
            {need.requester_identity_verified && <Badge tone="info"><BadgeCheck className="size-3.5" aria-hidden="true" />Identity verified</Badge>}
            {need.outcome_confirmed && <Badge tone="navy">Outcome confirmed</Badge>}
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight md:text-4xl">{need.title}</h1>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>Posted by {need.requester_name ?? "a SolveANeed member"}</span>
            <span className="inline-flex items-center gap-1"><MapPin className="size-4" aria-hidden="true" />{need.region ?? "United Kingdom"}</span>
            {need.deadline && (
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-4" aria-hidden="true" />Needed by {new Date(need.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
            )}
          </p>
          <section className="mt-8" aria-labelledby="about">
            <h2 id="about" className="text-xl font-bold">About this need</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-charcoal">{need.description}</p>
          </section>
          {need.intended_use && (
            <section className="mt-8" aria-labelledby="use">
              <h2 id="use" className="text-xl font-bold">How support will be used</h2>
              <p className="mt-3 whitespace-pre-line leading-relaxed text-charcoal">{need.intended_use}</p>
            </section>
          )}
          <section className="mt-8" aria-labelledby="accepts">
            <h2 id="accepts" className="text-xl font-bold">Ways you can help</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {SUPPORT_TYPES.filter((s) => need.accepted_support_types.includes(s.value)).map((s) => {
                const Icon = PillarIcon[s.value];
                return (
                  <li key={s.value} className="flex gap-3 rounded-2xl border border-line bg-soft p-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-900 text-gold-500"><Icon className="size-5" aria-hidden="true" /></span>
                    <span><span className="block font-bold text-navy-900">{s.label}</span><span className="text-sm text-muted">{s.description}</span></span>
                  </li>
                );
              })}
            </ul>
          </section>
          <p className="mt-8 text-xs text-muted">
            Reviewed by a SolveANeed moderator before publication. Review is not a guarantee — please use your judgement and report anything that concerns you.
          </p>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <p className="text-3xl font-extrabold text-navy-900">{money(need.amount_minor)}</p>
            <p className="text-sm text-muted">requested in {need.currency}</p>
            <ProgressBar basisPoints={need.funding_basis_points} label={`${money(need.funded_minor)} of ${money(need.amount_minor)} supported`} className="mt-5" />
            <p className="mt-2 text-sm"><strong>{money(need.funded_minor)}</strong> supported · {pct}%</p>

            <div className="mt-6 space-y-3">
              {viewer ? (
                <>
                  {own ? (
                    <ButtonLink href="/dashboard/requester/offers" variant="outline" className="w-full">View offers on your needs</ButtonLink>
                  ) : myOffer ? (
                    <ButtonLink href={`/dashboard/offers/${myOffer}`} variant="gold" size="lg" className="w-full">View your offer</ButtonLink>
                  ) : viewer.roles.includes("supporter") ? (
                    <ButtonLink href={`/needs/${need.id}/offer`} variant="gold" size="lg" className="w-full">Make an offer</ButtonLink>
                  ) : (
                    <ButtonLink href="/dashboard/settings" variant="outline" className="w-full">Add the supporter role to make offers</ButtonLink>
                  )}
                  <p className="text-xs text-muted">Offers don&apos;t take payment. Payments are not yet available on SolveANeed, so accepted offers are agreed but not funded.</p>
                  <form action={toggleSaveNeedAction}>
                    <input type="hidden" name="needId" value={need.id} />
                    <input type="hidden" name="saved" value={String(saved)} />
                    <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-navy-900/25 bg-white font-semibold text-navy-900 hover:border-navy-900" aria-pressed={saved}>
                      {saved ? <BookmarkCheck className="size-5" aria-hidden="true" /> : <Bookmark className="size-5" aria-hidden="true" />}
                      {saved ? "Saved" : "Save this need"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <ButtonLink href={`/sign-up?intent=help&next=${encodeURIComponent(`/needs/${need.id}`)}`} variant="gold" size="lg" className="w-full">I Want to Help</ButtonLink>
                  <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/needs/${need.id}`)}`} variant="outline" className="w-full">Sign in to save</ButtonLink>
                </>
              )}
            </div>
          </div>
          {viewer ? (
            <ReportForm targetType="need" targetId={need.id} />
          ) : (
            <p className="px-2 text-sm text-muted"><Link href={`/sign-in?next=${encodeURIComponent(`/needs/${need.id}`)}`} className="font-semibold text-navy-900 underline">Sign in</Link> to report a concern about this need.</p>
          )}
        </aside>
      </div>
    </main>
  );
}
