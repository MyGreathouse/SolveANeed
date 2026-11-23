import { Eye, FileLock2, ScaleIcon, ShieldCheck, Users, Wallet } from "lucide-react";
import { Section } from "./Section";

const items = [
  { icon: ShieldCheck, title: "Every need is reviewed", body: "Moderators check each need before it is published. Automated checks flag possible duplicates for human review — they never make final decisions alone." },
  { icon: FileLock2, title: "Private evidence stays private", body: "Supporting documents are stored privately and only visible to you and our reviewers through short-lived secure links." },
  { icon: Eye, title: "Clear, separate verification", body: "Identity verified, evidence reviewed and outcome confirmed are shown as separate badges, so you always know exactly what has been checked." },
  { icon: ScaleIcon, title: "Fair agreements", body: "Paid tasks and milestones use written, versioned terms agreed by both sides, with defined deadlines, cancellation and dispute steps." },
  { icon: Users, title: "Adults only, reporting built in", body: "Accounts are for people aged 18 and over. Anyone can report a concern and it reaches a real moderator." },
  { icon: Wallet, title: "Honest about payments", body: "Payments are not live yet. When they launch, they will run through a regulated payment provider — we will never store card details." },
];

export function TrustSafety() {
  return (
    <Section
      id="trust"
      tone="navy"
      eyebrow="Trust and safety"
      title="Built to be trusted with your needs, time and money."
      intro="Safety isn't a feature we bolt on later. It shapes how every part of SolveANeed works."
    >
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="rounded-[var(--radius-card)] border border-white/10 bg-white/[0.04] p-6">
            <Icon className="size-7 text-gold-500" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-on-navy-muted">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}
