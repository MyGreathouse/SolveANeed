import { formatMoney, type CurrencyInfo } from "@/lib/money";
import { supportTypeLabel } from "@/lib/domain/catalog";

type Terms = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const date = (v: unknown) =>
  typeof v === "string" ? new Date(`${v}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

/** Renders the agreed (or proposed) terms of an offer. Member text is shown as plain text only. */
export function TermsView({
  type,
  amountMinor,
  currency,
  terms,
  currencies,
}: {
  type: string;
  amountMinor: number;
  currency: string;
  terms: Terms;
  currencies: CurrencyInfo[];
}) {
  const money = (m: number) => formatMoney({ amountMinor: m, currency }, { list: currencies });
  const rows: [string, React.ReactNode][] = [["Type of support", supportTypeLabel(type)]];
  if (type !== "direct_support") rows.push([type === "paid_task" ? "Task price" : "Amount", money(amountMinor)]);

  if (type === "paid_task") {
    rows.push(["Task", str(terms.title)]);
    rows.push(["Description", <span key="d" className="whitespace-pre-line">{str(terms.description)}</span>]);
    rows.push(["Deliverables", <ul key="l" className="list-disc space-y-1 pl-5">{(terms.deliverables as string[] | undefined ?? []).map((d, i) => <li key={i}>{d}</li>)}</ul>]);
    rows.push(["Deadline", date(terms.deadline)]);
    rows.push(["Acceptance criteria", <span key="a" className="whitespace-pre-line">{str(terms.acceptance_criteria)}</span>]);
    rows.push(["Revisions included", String(terms.max_revisions ?? 0)]);
    rows.push(["Cancellation policy", str(terms.cancellation_policy)]);
    rows.push(["Where", "Remote only"]);
  }
  if (type === "direct_support") {
    rows.push(["Kind of help", ({ time: "Time", expertise: "Expertise", mentoring: "Mentoring" } as Record<string, string>)[str(terms.kind)] ?? str(terms.kind)]);
    rows.push(["Description", <span key="d" className="whitespace-pre-line">{str(terms.description)}</span>]);
    if (terms.schedule) rows.push(["Schedule", str(terms.schedule)]);
    rows.push(["Where", "Online or in a public place only"]);
    rows.push(["Money", "None — non-cash support"]);
  }
  if (terms.message) rows.push(["Message", <span key="m" className="whitespace-pre-line">{str(terms.message)}</span>]);

  return (
    <div>
      <dl className="divide-y divide-line">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-sm font-semibold text-navy-900">{k}</dt>
            <dd className="text-sm text-charcoal">{v}</dd>
          </div>
        ))}
      </dl>
      {type === "milestone" && (
        <ol className="mt-4 space-y-3">
          {(terms.milestones as Terms[] | undefined ?? []).map((m, i) => (
            <li key={i} className="rounded-2xl border border-line bg-soft p-4">
              <p className="font-semibold text-navy-900">{i + 1}. {str(m.title)} <span className="font-normal text-muted">· {money(Number(m.amount_minor))} · due {date(m.due_date)}</span></p>
              <p className="mt-1 text-sm"><span className="font-semibold">Criteria:</span> {str(m.criteria)}</p>
              <p className="text-sm"><span className="font-semibold">Evidence:</span> {str(m.evidence)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
