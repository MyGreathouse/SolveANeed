import { Section } from "./Section";

export const FAQS = [
  {
    q: "Is SolveANeed a crowdfunding site?",
    a: "Not only. Supporters can give money, but they can also offer fairly paid remote tasks, fund agreed milestones, or provide a direct solution such as equipment, training or mentorship.",
  },
  {
    q: "Who can use SolveANeed?",
    a: "Adults aged 18 and over. We are starting in the United Kingdom, with wider availability planned in future.",
  },
  {
    q: "Do I have to complete tasks to receive help?",
    a: "No. Gifts are always unconditional. Paid tasks are only offered to requesters who choose to opt in, and you can decline any offer.",
  },
  {
    q: "How do you check that needs are genuine?",
    a: "Every need is reviewed by a moderator before publication. Requesters can upload private supporting evidence, and we show separate badges when evidence has been reviewed or identity has been verified. No check is perfect, so please report anything that concerns you.",
  },
  {
    q: "Can I give and receive help with the same account?",
    a: "Yes. One account can be used as a requester, a supporter, or both. You can switch roles in your settings.",
  },
  {
    q: "Are payments live?",
    a: "Not yet. We are building payments with a regulated provider and will only switch them on after legal review and full testing. Until then, no money moves through SolveANeed.",
  },
  {
    q: "Which currencies are supported?",
    a: "Needs can currently be posted in pounds sterling, euros, US dollars and Nigerian naira. Each need has one currency, and amounts are never mixed across currencies.",
  },
  {
    q: "Does SolveANeed charge fees?",
    a: "Giving is free. We plan a transparent fee on completed paid tasks (currently proposed at 5%), which will always be shown before you agree to anything. There are no hidden charges.",
  },
];

export function Faq() {
  return (
    <Section id="faq" tone="soft" eyebrow="Frequently asked questions" title="Questions, answered honestly.">
      <div className="mx-auto max-w-3xl divide-y divide-line rounded-[var(--radius-card)] border border-line bg-white">
        {FAQS.map((f) => (
          <details key={f.q} className="group px-6 py-1 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-semibold text-navy-900">
              {f.q}
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-50 text-lg transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <p className="pb-5 leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}
