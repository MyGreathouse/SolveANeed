import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "For Businesses", description: "Sponsor training, equipment, paid opportunities and community projects through SolveANeed." };

export default function BusinessesPage() {
  return (
    <main>
      <PageHero
        eyebrow="For businesses"
        title="Turn your community commitment into measurable outcomes."
        intro="Sponsor skills, equipment and opportunities for real people — with clear agreements and records of what was achieved."
        image="/images/solve-direct.webp"
        imageAlt="Colleagues smile together around a laptop in a bright office."
        imagePosition="object-[35%_50%]"
        actions={<ButtonLink href="/sign-up?intent=help" variant="gold" size="lg">Create a supporter account</ButtonLink>}
      />
      <section className="bg-white py-16">
        <div className="container-page grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            ["Sponsor training", "Pay approved training providers directly for people building new skills."],
            ["Offer fair, paid work", "Give requesters low-risk remote tasks with clear pay and acceptance criteria."],
            ["Provide equipment", "Supply the tools, laptops or equipment someone needs to work or study."],
            ["Fund milestones", "Release support as measurable goals are met, with a record of each step."],
          ].map(([t, b]) => (
            <div key={t} className="card p-6"><h2 className="text-lg font-bold">{t}</h2><p className="mt-2 text-sm text-muted">{b}</p></div>
          ))}
        </div>
        <div className="container-page mt-12 rounded-[2rem] bg-soft p-8 md:p-10">
          <h2 className="text-2xl font-extrabold">Business workspaces are on our roadmap</h2>
          <p className="mt-3 max-w-2xl text-muted">
            Organisation profiles, team members, funding budgets, approval workflows and outcome reporting will follow once the core marketplace has been validated. In the meantime, business representatives can join with a standard supporter account.
          </p>
        </div>
      </section>
    </main>
  );
}
