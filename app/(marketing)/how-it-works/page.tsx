import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { HowItWorks } from "@/components/home/HowItWorks";

export const metadata: Metadata = { title: "How It Works", description: "How SolveANeed connects people with genuine needs to people who can help: Give, Earn, Fund and Solve." };

const pillars = [
  {
    id: "give",
    name: "Give",
    title: "Unconditional financial support",
    image: "/images/give-support-v2.webp",
    alt: "A man comforts a grateful older woman beside a laptop.",
    points: ["Contribute the full amount or any part of it.", "Recurring giving is planned where legally and operationally supported.", "Requesters never have to complete tasks in return for a gift."],
  },
  {
    id: "earn",
    name: "Earn",
    title: "Task-based opportunities",
    image: "/images/earn-tasks-v2.webp",
    alt: "A smiling man wearing headphones writes notes beside his laptop.",
    points: ["Only for requesters who opt in to receiving work.", "Written agreement: deliverables, pay, deadline, acceptance criteria, revisions and cancellation.", "Early tasks are restricted to low-risk remote work.", "No coercion, no unreasonable personal demands, no illegal or deceptive work."],
  },
  {
    id: "fund",
    name: "Fund",
    title: "Milestone-based sponsorship",
    image: "/images/fund-milestones-v2.webp",
    alt: "A woman raises her fist in celebration while working at her laptop.",
    points: ["Support is released as agreed, measurable milestones are met.", "Example: £250 on completing a course, £250 for a business plan, £500 on evidence of equipment purchase.", "Milestones must be lawful, reasonable, verifiable and agreed before any funding.", "Milestone sponsorship is not automatically treated as charitable giving."],
  },
  {
    id: "solve",
    name: "Solve",
    title: "Direct practical assistance",
    image: "/images/solve-direct-v2.webp",
    alt: "A group of colleagues smile together around a laptop.",
    points: ["Purchase essential equipment or pay an approved training provider.", "Offer mentorship or professional expertise.", "Supplier payments will include verification, refund and dispute arrangements."],
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <PageHero
        eyebrow="How it works"
        title="Four ways to turn a need into a solution."
        intro="SolveANeed connects people who need help with individuals, businesses and organisations willing to help — through giving, paid opportunities, milestone sponsorship and direct solutions."
        image="/images/explore-categories-v2.webp"
        imageAlt="A delighted man raises his fist while looking at a laptop showing the SolveANeed logo."
        imagePosition="object-[50%_25%]"
        actions={
          <>
            <ButtonLink href="/get-started?path=need" variant="gold" size="lg">I Need Help</ButtonLink>
            <ButtonLink href="/get-started?path=help" variant="white" size="lg">I Want to Help</ButtonLink>
          </>
        }
      />
      <HowItWorks />
      <div className="bg-soft py-16 md:py-24">
        <div className="container-page space-y-16 md:space-y-24">
          {pillars.map((p, i) => (
            <section key={p.id} id={p.id} aria-labelledby={`${p.id}-title`} className="grid scroll-mt-24 items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <figure className={i % 2 ? "lg:order-2" : ""}>
                <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem]">
                  <Image src={p.image} alt={p.alt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover object-[50%_30%]" />
                </div>
              </figure>
              <div>
                <p className="eyebrow">{p.name.toUpperCase()}</p>
                <h2 id={`${p.id}-title`} className="mt-2 text-3xl font-extrabold">{p.title}</h2>
                <div className="gold-rule mt-5" aria-hidden="true" />
                <ul className="mt-6 space-y-3">
                  {p.points.map((pt) => (
                    <li key={pt} className="flex gap-3"><span className="mt-2 size-2 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />{pt}</li>
                  ))}
                </ul>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
