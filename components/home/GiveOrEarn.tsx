import Image from "next/image";
import { Check } from "lucide-react";
import { Section } from "./Section";
import { ButtonLink } from "@/components/ui/Button";

const panels = [
  {
    image: "/images/fund-couple-v2.webp",
    alt: "A man and a woman celebrate together while looking at a laptop.",
    position: "object-[50%_30%]",
    eyebrow: "For supporters",
    title: "Give help your way",
    points: [
      "Browse reviewed needs and filter by category, region or support type",
      "Give any amount, or the full amount requested",
      "Offer a paid task, sponsor milestones or provide a direct solution",
    ],
    cta: { href: "/get-started?path=help", label: "Start helping" },
  },
  {
    image: "/images/earn-inclusive-v2.webp",
    alt: "A smiling young woman in a wheelchair works on a laptop at a bright desk.",
    position: "object-[50%_50%]",
    eyebrow: "For requesters",
    title: "Earn support with dignity",
    points: [
      "Opt in to paid remote tasks — you're never required to",
      "Know the pay, deliverables and deadline before you agree",
      "Fair review, clear cancellation terms and dispute resolution",
    ],
    cta: { href: "/get-started?path=need", label: "Post your need" },
  },
];

export function GiveOrEarn() {
  return (
    <Section id="give-or-earn" tone="soft" eyebrow="Give help or earn support" title="Two sides. One trusted marketplace.">
      <div className="grid gap-6 lg:grid-cols-2">
        {panels.map((p) => (
          <article key={p.title} className="card overflow-hidden">
            <div className="relative aspect-[16/9]">
              <Image src={p.image} alt={p.alt} fill sizes="(min-width: 1024px) 40vw, 100vw" className={`object-cover ${p.position}`} />
            </div>
            <div className="p-6 md:p-8">
              <p className="eyebrow">{p.eyebrow}</p>
              <h3 className="mt-2 text-2xl font-extrabold">{p.title}</h3>
              <ul className="mt-5 space-y-3">
                {p.points.map((pt) => (
                  <li key={pt} className="flex gap-3 text-charcoal">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-700 text-white">
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                    {pt}
                  </li>
                ))}
              </ul>
              <ButtonLink href={p.cta.href} variant="navy" className="mt-7">{p.cta.label}</ButtonLink>
            </div>
          </article>
        ))}
      </div>
    </Section>
  );
}
