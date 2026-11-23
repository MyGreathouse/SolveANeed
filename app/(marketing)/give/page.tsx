import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Give", description: "Give unconditional support to genuine, reviewed needs on SolveANeed." };

export default function GivePage() {
  return (
    <main>
      <PageHero
        eyebrow="GIVE"
        title="Support a real need, with no strings attached."
        intro="Browse needs that have been reviewed by our moderators, and give the full amount or whatever you can."
        image="/images/community-v2.webp"
        imageAlt="A diverse group of smiling people standing together outdoors."
        imagePosition="object-center"
        actions={
          <>
            <ButtonLink href="/needs" variant="gold" size="lg">Explore needs</ButtonLink>
            <ButtonLink href="/get-started?path=help" variant="white" size="lg">Create a supporter account</ButtonLink>
          </>
        }
      />
      <section className="bg-white py-16">
        <div className="container-page grid gap-6 md:grid-cols-3">
          {[
            ["Choose a need", "Filter by category, region, amount and verification. Save needs to come back to later."],
            ["Give what you can", "Contribute the full amount requested or part of it. Gifts never require the requester to do anything in return."],
            ["See the difference", "Requesters can share progress, and outcomes confirmed by our team are clearly labelled."],
          ].map(([t, b]) => (
            <div key={t} className="card p-6"><h2 className="text-xl font-bold">{t}</h2><p className="mt-2 text-muted">{b}</p></div>
          ))}
        </div>
        <div className="container-page mt-10">
          <Alert tone="info" title="Payments are not live yet">
            You can create an account, browse and save needs today. Giving will open once our regulated payment partner is in place and fully tested.
          </Alert>
        </div>
      </section>
    </main>
  );
}
