import Image from "next/image";
import { Section } from "./Section";
import { ButtonLink } from "@/components/ui/Button";

export function BusinessPartnerships() {
  return (
    <Section id="business" eyebrow="Business partnerships" title="Purpose-led businesses, measurable outcomes.">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]">
          <Image
            src="/images/solve-direct.webp"
            alt="A team of colleagues gathered around a laptop, smiling and pointing at the screen."
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-[35%_50%]"
          />
        </div>
        <div>
          <p className="text-lg leading-relaxed text-muted">
            Businesses can sponsor training, provide equipment, offer fairly paid remote work, or fund milestones for people in their community — with clear records of what was agreed and achieved.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {["Sponsor skills and training", "Offer paid remote tasks", "Provide essential equipment", "Fund community projects"].map((t) => (
              <li key={t} className="rounded-2xl border border-line bg-soft px-4 py-3 text-sm font-semibold text-navy-900">{t}</li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted">Business accounts with team members and approval workflows are planned for a later phase.</p>
          <ButtonLink href="/businesses" variant="navy" className="mt-6">Partner with SolveANeed</ButtonLink>
        </div>
      </div>
    </Section>
  );
}
