import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const viewer = await requireViewer("/dashboard/messages");
  const supabase = await createClient();
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, offer_id, requester_id, supporter_id, created_at")
    .or(`requester_id.eq.${viewer.id},supporter_id.eq.${viewer.id}`)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = convs ?? [];
  const ids = list.map((c) => c.id);
  const [latest, reads, names] = await Promise.all([
    ids.length
      ? supabase.from("messages").select("conversation_id, created_at, sender_id").in("conversation_id", ids).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [] as { conversation_id: string; created_at: string; sender_id: string }[] }),
    ids.length ? supabase.from("conversation_reads").select("conversation_id, last_read_at").in("conversation_id", ids) : Promise.resolve({ data: [] as { conversation_id: string; last_read_at: string }[] }),
    Promise.all(list.map((c) => c.offer_id ? supabase.rpc("deal_party_names", { p_offer_id: c.offer_id }) : Promise.resolve({ data: [] }))),
  ]);
  const last = new Map<string, { created_at: string; sender_id: string }>();
  for (const m of latest.data ?? []) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);
  const readAt = new Map((reads.data ?? []).map((r) => [r.conversation_id, r.last_read_at]));
  const rows = list
    .map((c, i) => {
      const n = ((names[i]?.data ?? []) as { requester_name: string; supporter_name: string }[])[0];
      const other = c.requester_id === viewer.id ? n?.supporter_name : n?.requester_name;
      const lm = last.get(c.id);
      const unread = !!lm && lm.sender_id !== viewer.id && (!readAt.get(c.id) || readAt.get(c.id)! < lm.created_at);
      return { ...c, other: other ?? "Member", lastAt: lm?.created_at ?? c.created_at, unread };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <>
      <PageHeader title="Messages" description="Every conversation is linked to an offer or agreement. Keep contact and payments on SolveANeed." />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/dashboard/offers/${r.offer_id}`} className="card flex items-center justify-between gap-3 p-5 hover:border-navy-900/30">
                <span className="font-semibold text-navy-900">{r.unread && <span className="sr-only">Unread: </span>}Conversation with {r.other}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  {r.unread && <span className="size-2.5 rounded-full bg-gold-500" aria-hidden="true" />}
                  {new Date(r.lastAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No conversations yet" description="A conversation starts when an offer is made on a need." />
      )}
    </>
  );
}
