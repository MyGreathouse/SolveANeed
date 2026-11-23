import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/needs", label: "Explore Needs" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/get-started?path=need", label: "Post a Need" },
      { href: "/get-started?path=help", label: "Become a Supporter" },
    ],
  },
  {
    title: "Ways to help",
    links: [
      { href: "/give", label: "Give" },
      { href: "/earn", label: "Earn" },
      { href: "/how-it-works#fund", label: "Fund" },
      { href: "/how-it-works#solve", label: "Solve" },
      { href: "/businesses", label: "For Businesses" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/#trust", label: "Trust and Safety" },
      { href: "/#faq", label: "FAQs" },
      { href: "/legal/terms", label: "Terms of Use" },
      { href: "/legal/privacy", label: "Privacy Notice" },
      { href: "/legal/cookies", label: "Cookie Notice" },
      { href: "/legal/acceptable-use", label: "Acceptable Use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy-950 text-white on-navy">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo size="md" showTagline />
          <p className="mt-5 text-sm leading-relaxed text-on-navy-muted">
            Post a Need. Solve a Need. A UK marketplace connecting people with genuine needs to those able to help.
          </p>
          <p className="mt-4 text-sm font-semibold tracking-[0.2em] text-gold-500">GIVE • EARN • FUND • SOLVE</p>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="text-sm font-semibold text-white">{col.title}</h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-on-navy-muted hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-on-navy-muted md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} SolveANeed · solveaneed.com · Operated in the United Kingdom.</p>
          <p>Payments are not yet live. SolveANeed does not currently hold or transfer funds.</p>
        </div>
      </div>
    </footer>
  );
}
