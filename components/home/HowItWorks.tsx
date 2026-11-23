import { Section } from "./Section";

const steps = [
  {
    n: "01",
    title: "Post a genuine need",
    body: "Describe what you need, how much it costs and how support will be used. Choose which kinds of help you'll accept.",
  },
  {
    n: "02",
    title: "Our team reviews it",
    body: "Every need is checked by a moderator before it goes live. Supporting evidence stays private to you and our reviewers.",
  },
  {
    n: "03",
    title: "Receive offers of help",
    body: "Supporters can give, offer paid remote tasks, fund agreed milestones or provide a direct solution such as equipment or training.",
  },
  {
    n: "04",
    title: "Agree clear terms",
    body: "Every paid task and milestone has written, versioned terms — deliverables, deadlines and fair dispute handling — agreed before work begins.",
  },
];

export function HowItWorks() {
  return (
    <Section
      id="how"
      eyebrow="How SolveANeed works"
      title="Simple for people who need help. Transparent for people who give it."
      intro="One account, two sides. You can ask for help, offer help, or both."
    >
      <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n} className="relative rounded-[var(--radius-card)] border border-line bg-soft p-6">
            <span className="font-display text-sm font-extrabold tracking-widest text-gold-700">{s.n}</span>
            <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
