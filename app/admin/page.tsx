import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";

const PLANNED = [
  ["Verification", 2], ["Offers", 3], ["Agreements", 3], ["Disputes", 3], ["Payments", 4], ["Organisations", 5], ["Content Management", 2], ["Settings", 2],
] as const;

export default async function AdminOverview() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("moderation_stats");
  const s = (data ?? {}) as Record<string, number>;
  const tiles = [
    { label: "Needs awaiting review", value: s.pending_needs, href: "/admin/needs" },
    { label: "Open reports", value: s.open_reports, href: "/admin/reports" },
    { label: "Unreviewed risk signals", value: s.open_signals, href: "/admin/needs?signals=1" },
    { label: "Live needs", value: s.published_needs, href: "/admin/needs?status=published" },
    { label: "Active members", value: s.members, href: "/admin/users" },
    { label: "Suspended accounts", value: s.suspended, href: "/admin/users?status=suspended" },
  ];
  return (
    <>
      <PageHeader eyebrow="Admin" title="Overview" description="Automated signals assist reviewers — they never make decisions on their own." />
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="card block p-5 hover:shadow-[var(--shadow-lift)]">
              <span className="block text-3xl font-extrabold text-navy-900">{t.value ?? "—"}</span>
              <span className="text-sm text-muted">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <section className="card p-6" aria-labelledby="planned">
        <h2 id="planned" className="font-bold">Modules on the roadmap</h2>
        <p className="mt-1 text-sm text-muted">These modules are not built yet and are listed for planning only.</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {PLANNED.map(([name, phase]) => (
            <li key={name} className="rounded-full bg-navy-50 px-3 py-1 text-sm text-charcoal">{name} <span className="text-muted">· Phase {phase}</span></li>
          ))}
        </ul>
      </section>
    </>
  );
}
