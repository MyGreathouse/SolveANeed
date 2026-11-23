import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "./Section";
import { PillarIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils/cn";

const pillars = [
  {
    key: "gift",
    name: "Give",
    tagline: "Support a real need",
    body: "Contribute all or part of a requested amount, with no strings attached. Requesters are never asked to do anything in return.",
    href: "/give",
    className: "bg-navy-900 text-white",
    iconClass: "bg-gold-500 text-navy-900",
  },
  {
    key: "paid_task",
    name: "Earn",
    tagline: "Take on paid opportunities",
    body: "Requesters who opt in can earn towards their goal by completing fairly paid, low-risk remote tasks with agreed acceptance criteria.",
    href: "/earn",
    className: "bg-teal-700 text-white",
    iconClass: "bg-white text-teal-800",
  },
  {
    key: "milestone",
    name: "Fund",
    tagline: "Sponsor meaningful goals",
    body: "Commit support that is released as agreed, measurable milestones are met — for example completing a course or submitting a business plan.",
    href: "/how-it-works#fund",
    className: "bg-gold-500 text-navy-900",
    iconClass: "bg-navy-900 text-gold-500",
  },
  {
    key: "direct_support",
    name: "Solve",
    tagline: "Provide practical solutions",
    body: "Supply equipment, pay an approved training provider, or offer mentorship and professional expertise directly.",
    href: "/how-it-works#solve",
    className: "bg-charcoal text-white",
    iconClass: "bg-gold-500 text-navy-900",
  },
] as const;

export function FourWays() {
  return (
    <Section
      id="ways"
      tone="soft"
      eyebrow="Four ways to help"
      title="Help isn't one-size-fits-all."
      intro="SolveANeed is more than crowdfunding. Supporters choose the form of help that fits — and requesters choose what they'll accept."
    >
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {pillars.map((p) => {
          const Icon = PillarIcon[p.key];
          const dark = p.key !== "milestone";
          return (
            <li key={p.key} className={cn("relative flex flex-col rounded-[1.5rem] p-6 shadow-[var(--shadow-card)]", p.className)}>
              <span className={cn("grid size-12 place-items-center rounded-2xl", p.iconClass)}>
                <Icon className="size-6" aria-hidden="true" />
              </span>
              <h3 className={cn("mt-5 text-2xl font-extrabold", dark ? "text-white" : "text-navy-900")}>{p.name}</h3>
              <p className={cn("text-sm font-semibold", p.key === "paid_task" ? "text-white" : dark ? "text-gold-300" : "text-navy-900")}>{p.tagline}</p>
              <p className={cn("mt-3 text-sm leading-relaxed", dark ? "text-white/85" : "text-navy-900/85")}>{p.body}</p>
              <Link
                href={p.href}
                className={cn("mt-6 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold after:absolute after:inset-0", dark ? "text-white" : "text-navy-900")}
              >
                Learn about {p.name} <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
