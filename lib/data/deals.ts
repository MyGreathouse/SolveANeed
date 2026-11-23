import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Offers, agreements and conversations as seen by a party (RLS limits every
 * query to the caller's own deals). Staff case views use the audited RPCs.
 */
type T = Database["public"]["Tables"];
export type OfferRow = T["offers"]["Row"];
export type OfferVersionRow = T["offer_versions"]["Row"];
export type AgreementRow = T["agreements"]["Row"];
export type DealEventRow = T["deal_events"]["Row"];
export type MessageRow = T["messages"]["Row"];
export type FileRow = T["conversation_files"]["Row"];
export type DeliverableRow = T["task_deliverables"]["Row"];
export type MilestoneRow = T["agreement_milestones"]["Row"];
export type DisputeRow = T["disputes"]["Row"];

export interface OfferListItem extends OfferRow {
  need_title: string;
  agreement_id: string | null;
}

export async function listMyOffers(viewerId: string, view: "received" | "made"): Promise<OfferListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select("*, needs(title), agreements(id)")
    .eq(view === "received" ? "requester_id" : "supporter_id", viewerId)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((o) => {
    const { needs, agreements, ...rest } = o as typeof o & { needs: { title: string } | null; agreements: { id: string }[] | { id: string } | null };
    const ag = Array.isArray(agreements) ? agreements[0] : agreements;
    return { ...rest, need_title: needs?.title ?? "Need", agreement_id: ag?.id ?? null };
  });
}

export interface OfferDetail {
  offer: OfferRow;
  needTitle: string;
  versions: OfferVersionRow[];
  events: DealEventRow[];
  names: { requester: string; supporter: string };
  conversationId: string | null;
  agreement: AgreementRow | null;
}

export async function getOfferDetail(id: string): Promise<OfferDetail | null> {
  const supabase = await createClient();
  const { data: offer } = await supabase.from("offers").select("*").eq("id", id).maybeSingle();
  if (!offer) return null;
  const [versions, events, names, conv, agreement, need] = await Promise.all([
    supabase.from("offer_versions").select("*").eq("offer_id", id).order("version", { ascending: true }),
    supabase.from("deal_events").select("*").eq("offer_id", id).order("id", { ascending: true }),
    supabase.rpc("deal_party_names", { p_offer_id: id }),
    supabase.from("conversations").select("id").eq("offer_id", id).maybeSingle(),
    supabase.from("agreements").select("*").eq("offer_id", id).maybeSingle(),
    supabase.from("needs_public").select("title").eq("id", offer.need_id).maybeSingle(),
  ]);
  const n = (names.data ?? [])[0];
  // The requester can always read their own need; others see the public title.
  let needTitle = need.data?.title ?? null;
  if (!needTitle) {
    const own = await supabase.from("needs").select("title").eq("id", offer.need_id).maybeSingle();
    needTitle = own.data?.title ?? "A SolveANeed need";
  }
  return {
    offer,
    needTitle,
    versions: versions.data ?? [],
    events: events.data ?? [],
    names: { requester: n?.requester_name ?? "Requester", supporter: n?.supporter_name ?? "Supporter" },
    conversationId: conv.data?.id ?? null,
    agreement: agreement.data ?? null,
  };
}

export interface Conversation {
  id: string;
  messages: MessageRow[];
  files: FileRow[];
  blocked: boolean;
}

export async function getConversation(conversationId: string, viewerId: string, otherId: string): Promise<Conversation> {
  const supabase = await createClient();
  const [messages, files, blocks] = await Promise.all([
    supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(500),
    supabase.from("conversation_files").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true }),
    supabase.from("user_blocks").select("blocked_id").eq("blocker_id", viewerId).eq("blocked_id", otherId),
    supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId }),
  ]);
  return {
    id: conversationId,
    messages: messages.data ?? [],
    files: files.data ?? [],
    blocked: (blocks.data ?? []).length > 0,
  };
}

export interface AgreementListItem extends AgreementRow {
  need_title: string;
}

export async function listMyAgreements(viewerId: string): Promise<AgreementListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agreements")
    .select("*")
    .or(`requester_id.eq.${viewerId},supporter_id.eq.${viewerId}`)
    .order("updated_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((a) => ({
    ...a,
    need_title: ((a.terms_snapshot as { need_title?: string } | null)?.need_title) ?? "Need",
  }));
}

export interface AgreementDetail {
  agreement: AgreementRow;
  funding: "funded" | "not_funded";
  deliverables: DeliverableRow[];
  milestones: MilestoneRow[];
  disputes: DisputeRow[];
  events: DealEventRow[];
  names: { requester: string; supporter: string };
  conversationId: string | null;
  filesByPath: Record<string, { id: string; file_name: string }>;
}

export async function getAgreementDetail(id: string): Promise<AgreementDetail | null> {
  const supabase = await createClient();
  const { data: agreement } = await supabase.from("agreements").select("*").eq("id", id).maybeSingle();
  if (!agreement) return null;
  const [funding, deliverables, milestones, disputes, events, names, conv] = await Promise.all([
    supabase.rpc("agreement_funding_status", { p_agreement_id: id }),
    supabase.from("task_deliverables").select("*").eq("agreement_id", id).order("submitted_at", { ascending: true }),
    supabase.from("agreement_milestones").select("*").eq("agreement_id", id).order("position", { ascending: true }),
    supabase.from("disputes").select("*").eq("agreement_id", id).order("opened_at", { ascending: true }),
    supabase.from("deal_events").select("*").eq("offer_id", agreement.offer_id).order("id", { ascending: true }),
    supabase.rpc("deal_party_names", { p_offer_id: agreement.offer_id }),
    supabase.from("conversations").select("id").eq("offer_id", agreement.offer_id).maybeSingle(),
  ]);
  const n = (names.data ?? [])[0];
  const files = conv.data?.id
    ? (await supabase.from("conversation_files").select("id, file_name, storage_path").eq("conversation_id", conv.data.id)).data ?? []
    : [];
  return {
    filesByPath: Object.fromEntries(files.map((f) => [f.storage_path, { id: f.id, file_name: f.file_name }])),
    agreement,
    funding: funding.data === "funded" ? "funded" : "not_funded",
    deliverables: deliverables.data ?? [],
    milestones: milestones.data ?? [],
    disputes: disputes.data ?? [],
    events: events.data ?? [],
    names: { requester: n?.requester_name ?? "Requester", supporter: n?.supporter_name ?? "Supporter" },
    conversationId: conv.data?.id ?? null,
  };
}

export async function getMyOpenOfferForNeed(viewerId: string, needId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("offers")
    .select("id")
    .eq("need_id", needId)
    .eq("supporter_id", viewerId)
    .in("status", ["proposed", "countered", "accepted", "disputed"])
    .limit(1);
  return data?.[0]?.id ?? null;
}

export async function getNeedOffersSummary(needId: string): Promise<{ open: number }> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("offers")
    .select("id", { count: "exact", head: true })
    .eq("need_id", needId)
    .in("status", ["proposed", "countered"]);
  return { open: count ?? 0 };
}

/** Plain-language history line for a deal event (never includes member-written text). */
export function describeEvent(e: DealEventRow, names: { requester: string; supporter: string }, actorIsRequester: boolean | null): string {
  const who = e.actor_id == null ? "SolveANeed" : actorIsRequester ? names.requester : names.supporter;
  const d = (e.detail ?? {}) as Record<string, unknown>;
  switch (e.event) {
    case "offer_proposed": return `${who} made an offer (version 1)`;
    case "offer_countered": return `${who} proposed new terms (version ${e.version})`;
    case "offer_accepted": return `${who} accepted version ${e.version}`;
    case "agreement_created": return `Agreement created from version ${e.version} — terms locked`;
    case "offer_declined": return `${who} declined the offer`;
    case "offer_withdrawn": return `${who} withdrew the offer`;
    case "offer_expired": return "The offer expired without a response";
    case "work_started": return `${who} started work${d.test_mode ? " (test environment — no payment)" : ""}`;
    case "work_submitted": return `${who} submitted work for review`;
    case "revision_requested": return `${who} requested revision ${String(d.revision ?? "")} of ${String(d.of ?? "")}`;
    case "work_accepted": return `${who} accepted the work`;
    case "work_auto_accepted": return "Work accepted automatically: the review window passed";
    case "support_received": return `${who} confirmed the support was received`;
    case "agreement_cancelled": return `${who} cancelled the agreement`;
    case "dispute_opened": return `${who} opened a dispute`;
    case "dispute_resolved": return `A SolveANeed moderator resolved the dispute (${d.outcome === "complete" ? "completed" : "cancelled"})`;
    default: return e.event.replace(/_/g, " ");
  }
}
