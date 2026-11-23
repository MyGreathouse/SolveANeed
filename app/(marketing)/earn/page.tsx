import type { Metadata } from "next";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export const metadata: Metadata = { title: "Earn", description: "Earn towards your goal with fairly paid, clearly agreed remote tasks." };

const protections = [
  "Participation is always voluntary — you choose whether to receive task offers.",
  "Compensation, deliverables and deadlines are written down before work starts.",
  "Objective acceptance criteria and a defined revision policy.",
  "No unilateral changes: new terms create a new version that both sides must accept.",
  "Clear cancellation terms and a fair dispute process.",
  "Early tasks are limited to low-risk remote work. Exploitative, illegal or personal demands are prohibited.",
];

export default function EarnPage() {
  return (
    <main>
      <PageHero
        eyebrow="EARN"
        title="Earn towards your goal, on fair terms."
        intro="If you choose to, supporters can offer you paid remote tasks — designing materials, writing, research and more — that help you reach your goal with dignity."
        image="/images/earn-inclusive.webp"
        imageAlt="A young woman in a wheelchair smiles while working on a laptop."
        imagePosition="object-[30%_50%]"
        actions={
          <>
            <ButtonLink href="/get-started?path=need" variant="gold" size="lg">Post a need</ButtonLink>
            <ButtonLink href="/get-started?path=help" variant="white" size="lg">Offer paid work</ButtonLink>
          </>
        }
      />
      <section className="bg-white py-16">
        <div className="container-page grid gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="text-3xl font-extrabold">Your protections</h2>
            <div className="gold-rule mt-5" aria-hidden="true" />
            <p className="mt-5 text-muted">Every paid task follows the same path: offer → negotiation → acceptance → payment readiness → work → submission → review → resolution → payout.</p>
          </div>
          <ul className="space-y-3">
            {protections.map((p) => (
              <li key={p} className="rounded-2xl border border-line bg-soft px-5 py-4">{p}</li>
            ))}
          </ul>
        </div>
        <div className="container-page mt-10">
          <Alert tone="info" title="Coming in a later phase">
            Paid task agreements are being built now. Until regulated payments are live, no work should begin on the promise of payment through SolveANeed. We will not describe funds as held in escrow unless the regulated arrangement genuinely supports it.
          </Alert>
        </div>
      </section>
    </main>
  );
}
