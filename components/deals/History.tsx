import { describeEvent, type DealEventRow } from "@/lib/data/deals";

export function History({
  events,
  names,
  requesterId,
}: {
  events: DealEventRow[];
  names: { requester: string; supporter: string };
  requesterId: string;
}) {
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-5" aria-label="Offer and agreement history">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.6rem] top-1.5 size-3 rounded-full border-2 border-white bg-teal-700" aria-hidden="true" />
          <p className="text-sm font-medium text-navy-900">{describeEvent(e, names, e.actor_id == null ? null : e.actor_id === requesterId)}</p>
          <time dateTime={e.created_at} className="text-xs text-muted">
            {new Date(e.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </li>
      ))}
    </ol>
  );
}
