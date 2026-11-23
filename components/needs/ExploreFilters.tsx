import Link from "next/link";
import { CATEGORIES, FUNDING_PROGRESS_FILTERS, SUPPORT_TYPES, UK_REGIONS } from "@/lib/domain/catalog";
import type { ExploreFilters as Filters } from "@/lib/domain/validation";
import type { CurrencyInfo } from "@/lib/money";

/** Plain GET form: works without JavaScript and produces shareable URLs. */
export function ExploreFilters({ filters, currencies }: { filters: Filters; currencies: CurrencyInfo[] }) {
  const enabled = currencies.filter((c) => c.enabled);
  return (
    <form method="get" action="/needs" className="card space-y-5 p-5" aria-label="Filter needs">
      <div>
        <label htmlFor="q" className="block text-sm font-semibold text-navy-900">Search</label>
        <input id="q" name="q" type="search" defaultValue={filters.q} placeholder="e.g. laptop, course" className="field-input mt-1.5" maxLength={100} />
      </div>
      <div>
        <label htmlFor="category" className="block text-sm font-semibold text-navy-900">Category</label>
        <select id="category" name="category" defaultValue={filters.category ?? ""} className="field-input mt-1.5">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="support" className="block text-sm font-semibold text-navy-900">Support type</label>
        <select id="support" name="support" defaultValue={filters.support ?? ""} className="field-input mt-1.5">
          <option value="">Any</option>
          {SUPPORT_TYPES.map((s) => <option key={s.value} value={s.value}>{s.label} — {s.description}</option>)}
        </select>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-navy-900">Amount</legend>
        <p className="text-xs text-muted">Amounts are compared within one currency only.</p>
        <div className="mt-1.5 grid grid-cols-[6rem_1fr_1fr] gap-2">
          <select name="currency" aria-label="Currency" defaultValue={filters.currency ?? ""} className="field-input px-2">
            <option value="">Any</option>
            {enabled.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
          </select>
          <input name="min" inputMode="decimal" aria-label="Minimum amount" placeholder="Min" defaultValue={filters.min} className="field-input" />
          <input name="max" inputMode="decimal" aria-label="Maximum amount" placeholder="Max" defaultValue={filters.max} className="field-input" />
        </div>
      </fieldset>
      <div>
        <label htmlFor="progress" className="block text-sm font-semibold text-navy-900">Funding progress</label>
        <select id="progress" name="progress" defaultValue={filters.progress ?? "any"} className="field-input mt-1.5">
          {FUNDING_PROGRESS_FILTERS.map((p) => <option key={p.value} value={p.value === "any" ? "" : p.value}>{p.label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="region" className="block text-sm font-semibold text-navy-900">Region</label>
        <select id="region" name="region" defaultValue={filters.region ?? ""} className="field-input mt-1.5">
          <option value="">All of the UK</option>
          {UK_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="verified" className="block text-sm font-semibold text-navy-900">Verification</label>
        <select id="verified" name="verified" defaultValue={filters.verified ?? ""} className="field-input mt-1.5">
          <option value="">Any</option>
          <option value="evidence">Evidence reviewed</option>
          <option value="identity">Requester ID verified</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-navy-900 px-5 font-semibold text-white hover:bg-navy-800">Apply filters</button>
        <Link href="/needs" className="inline-flex min-h-11 items-center justify-center rounded-full px-4 font-semibold text-navy-900 hover:bg-navy-50">Clear</Link>
      </div>
    </form>
  );
}
