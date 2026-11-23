"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole, requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies, currencyFor } from "@/lib/data/needs";
import { parseOfferForm, screeningWarning } from "@/lib/domain/offers";
import { SUPPORT_TYPE_VALUES, type SupportType } from "@/lib/domain/catalog";
import { uuidSchema } from "@/lib/domain/validation";
import { checkEvidenceFile, safeFileName } from "@/lib/security/file-validation";
import { runJobs } from "@/lib/server/jobs";
import { str, type FormState } from "@/lib/utils/form";

/**
 * Offer, agreement and messaging actions. Every state change is made by a
 * SECURITY DEFINER function that re-checks the caller, state machine, blocks
 * and rate limits; these actions only validate input and map errors.
 */

// Our database functions raise member-safe messages with these codes.
const SAFE_CODES = new Set(["22023", "42501", "P0002", "54000", "40001"]);
function friendly(error: { code?: string; message: string } | null, fallback: string): string {
  if (!error) return fallback;
  return error.code && SAFE_CODES.has(error.code) ? error.message : fallback;
}

const id = (fd: FormData, key: string) => uuidSchema.parse(str(fd, key));
const typeOf = (v: string): SupportType => z.enum(SUPPORT_TYPE_VALUES).parse(v);

/** Echoes text fields back so the form keeps what the member typed after an error. */
function vals(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v.slice(0, 5000);
  return out;
}

function after(paths: string[]) {
  for (const p of paths) revalidatePath(p);
  void runJobs();
}

// ------------------------------------------------------------------ offers
export async function createOfferAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const needId = id(fd, "needId");
  await requireRole(["supporter"], { next: `/needs/${needId}/offer` });
  const type = typeOf(str(fd, "type"));
  const supabase = await createClient();
  const { data: need } = await supabase.from("needs_public").select("currency").eq("id", needId).maybeSingle();
  if (!need?.currency) return { errors: { form: "That need is not open for offers." }, values: vals(fd) };
  const info = currencyFor(need.currency, await getCurrencies());
  const parsed = parseOfferForm(type, fd, info.minorUnit);
  if (!parsed.ok) return { errors: parsed.errors, values: vals(fd) };

  const { data, error } = await supabase.rpc("create_offer", {
    p_need_id: needId,
    p_type: type,
    p_amount_minor: parsed.value.amountMinor,
    p_terms: parsed.value.terms as never,
  });
  if (error || !data) return { errors: { form: friendly(error, "We couldn't send your offer. Please try again.") }, values: vals(fd) };
  const res = data as { offer_id: string; warnings: string[] };
  after(["/dashboard/offers"]);
  const warn = screeningWarning(res.warnings) ? "&warn=1" : "";
  redirect(`/dashboard/offers/${res.offer_id}?notice=created${warn}`);
}

export async function counterOfferAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  const offerId = id(fd, "offerId");
  const version = z.coerce.number().int().min(1).parse(str(fd, "version"));
  const type = typeOf(str(fd, "type"));
  const info = currencyFor(str(fd, "currency"), await getCurrencies());
  const parsed = parseOfferForm(type, fd, info.minorUnit);
  if (!parsed.ok) return { errors: parsed.errors, values: vals(fd) };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("counter_offer", {
    p_offer_id: offerId,
    p_expected_version: version,
    p_amount_minor: parsed.value.amountMinor,
    p_terms: parsed.value.terms as never,
  });
  if (error) return { errors: { form: friendly(error, "We couldn't send your counter-offer. Please try again.") }, values: vals(fd) };
  after([`/dashboard/offers/${offerId}`, "/dashboard/offers"]);
  const warn = screeningWarning((data as { warnings: string[] }).warnings) ? "&warn=1" : "";
  redirect(`/dashboard/offers/${offerId}?notice=countered${warn}`);
}

async function simpleOfferAction(fd: FormData, rpc: "accept" | "decline" | "withdraw") {
  await requireViewer();
  const offerId = id(fd, "offerId");
  const supabase = await createClient();
  let error: { code?: string; message: string } | null = null;
  let agreementId: string | null = null;
  if (rpc === "accept") {
    const version = z.coerce.number().int().min(1).parse(str(fd, "version"));
    const r = await supabase.rpc("accept_offer", { p_offer_id: offerId, p_expected_version: version });
    error = r.error;
    agreementId = (r.data as string | null) ?? null;
  } else if (rpc === "decline") {
    error = (await supabase.rpc("decline_offer", { p_offer_id: offerId, p_reason: str(fd, "reason").slice(0, 1000) })).error;
  } else {
    error = (await supabase.rpc("withdraw_offer", { p_offer_id: offerId })).error;
  }
  if (error) redirect(`/dashboard/offers/${offerId}?error=${encodeURIComponent(friendly(error, "That didn't work. Please try again."))}`);
  after([`/dashboard/offers/${offerId}`, "/dashboard/offers", "/dashboard/agreements"]);
  if (agreementId) redirect(`/dashboard/agreements/${agreementId}?notice=agreed`);
  redirect(`/dashboard/offers/${offerId}?notice=${rpc === "decline" ? "declined" : "withdrawn"}`);
}

export async function acceptOfferAction(fd: FormData) {
  await simpleOfferAction(fd, "accept");
}
export async function declineOfferAction(fd: FormData) {
  await simpleOfferAction(fd, "decline");
}
export async function withdrawOfferAction(fd: FormData) {
  await simpleOfferAction(fd, "withdraw");
}

// ------------------------------------------------------------------ files
async function uploadConversationFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  viewerId: string,
  conversationId: string,
  file: File,
): Promise<{ id: string } | { error: string }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const check = checkEvidenceFile(file.type, file.size, head);
  if (!check.ok) return { error: check.error };
  const path = `${conversationId}/${viewerId}/${randomUUID()}.${check.ext}`;
  const { error: upErr } = await supabase.storage.from("conversation-files").upload(path, file, {
    contentType: check.mime,
    upsert: false,
    cacheControl: "private, max-age=0",
  });
  if (upErr) return { error: "Upload failed. You may not be able to send files in this conversation." };
  const { data, error } = await supabase.rpc("register_conversation_file", {
    p_conversation_id: conversationId,
    p_storage_path: path,
    p_file_name: safeFileName(file.name),
  });
  if (error || !data) return { error: friendly(error, "We couldn't attach that file.") };
  return { id: data as string };
}

// ------------------------------------------------------------------ messages
export async function sendMessageAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const conversationId = id(fd, "conversationId");
  const offerId = id(fd, "offerId");
  const body = str(fd, "body").trim();
  if (!body) return { errors: { body: "Write a message." } };
  if (body.length > 4000) return { errors: { body: "Messages must be 4,000 characters or fewer." } };
  const supabase = await createClient();
  let fileId: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const up = await uploadConversationFile(supabase, viewer.id, conversationId, file);
    if ("error" in up) return { errors: { file: up.error } };
    fileId = up.id;
  }
  const { data, error } = await supabase.rpc("send_message", {
    p_conversation_id: conversationId,
    p_body: body,
    p_file_id: fileId as unknown as string,
  });
  if (error) return { errors: { body: friendly(error, "Your message wasn't sent. Please try again.") } };
  after([`/dashboard/offers/${offerId}`, "/dashboard/messages"]);
  const warning = screeningWarning((data as { warnings: string[] }).warnings);
  return { ok: true, message: warning ?? "Message sent." };
}

export async function blockMemberAction(fd: FormData) {
  const viewer = await requireViewer();
  const offerId = id(fd, "offerId");
  const supabase = await createClient();
  const { data: o } = await supabase.from("offers").select("requester_id, supporter_id").eq("id", offerId).maybeSingle();
  if (!o) redirect("/dashboard/offers");
  const other = o.requester_id === viewer.id ? o.supporter_id : o.requester_id;
  const { error } = await supabase.rpc("block_user", { p_user_id: other, p_reason: str(fd, "reason").slice(0, 500) });
  if (error) redirect(`/dashboard/offers/${offerId}?error=${encodeURIComponent(friendly(error, "We couldn't block this member."))}`);
  after([`/dashboard/offers/${offerId}`, "/dashboard/settings"]);
  redirect(`/dashboard/offers/${offerId}?notice=blocked`);
}

// ------------------------------------------------------------------ agreements
type AgreementRpc = "start_task_work" | "confirm_support_received";
async function agreementAction(fd: FormData, rpc: AgreementRpc, notice: string) {
  await requireViewer();
  const agreementId = id(fd, "agreementId");
  const supabase = await createClient();
  const { error } = await supabase.rpc(rpc, { p_agreement_id: agreementId });
  if (error) redirect(`/dashboard/agreements/${agreementId}?error=${encodeURIComponent(friendly(error, "That didn't work. Please try again."))}`);
  after([`/dashboard/agreements/${agreementId}`, "/dashboard/agreements"]);
  redirect(`/dashboard/agreements/${agreementId}?notice=${notice}`);
}

export async function startTaskAction(fd: FormData) {
  await agreementAction(fd, "start_task_work", "started");
}
export async function confirmSupportAction(fd: FormData) {
  await agreementAction(fd, "confirm_support_received", "confirmed");
}

export async function submitWorkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const agreementId = id(fd, "agreementId");
  const description = str(fd, "description").trim();
  if (description.length < 20) return { errors: { description: "Describe what you are submitting (20+ characters)." } };
  const supabase = await createClient();
  let fileId: string | null = null;
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    const conversationId = id(fd, "conversationId");
    const up = await uploadConversationFile(supabase, viewer.id, conversationId, file);
    if ("error" in up) return { errors: { file: up.error } };
    fileId = up.id;
  }
  const { error } = await supabase.rpc("submit_task_work", {
    p_agreement_id: agreementId,
    p_description: description,
    p_attachment_id: fileId as unknown as string,
  });
  if (error) return { errors: { form: friendly(error, "We couldn't submit your work. Please try again.") } };
  after([`/dashboard/agreements/${agreementId}`]);
  redirect(`/dashboard/agreements/${agreementId}?notice=submitted`);
}

export async function reviewWorkAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  const agreementId = id(fd, "agreementId");
  const decision = z.enum(["accept", "revision"]).parse(str(fd, "decision"));
  const note = str(fd, "note").trim();
  if (decision === "revision" && note.length < 10) {
    return { errors: { note: "Explain what needs to change against the acceptance criteria (10+ characters)." } };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_task_work", { p_agreement_id: agreementId, p_decision: decision, p_note: note });
  if (error) return { errors: { form: friendly(error, "We couldn't record your review. Please try again.") } };
  after([`/dashboard/agreements/${agreementId}`]);
  redirect(`/dashboard/agreements/${agreementId}?notice=${decision === "accept" ? "accepted" : "revision"}`);
}

export async function cancelAgreementAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  const agreementId = id(fd, "agreementId");
  const reason = str(fd, "reason").trim();
  if (reason.length < 5) return { errors: { reason: "Give a short reason (5+ characters)." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_agreement", { p_agreement_id: agreementId, p_reason: reason });
  if (error) return { errors: { form: friendly(error, "We couldn't cancel this agreement.") } };
  after([`/dashboard/agreements/${agreementId}`]);
  redirect(`/dashboard/agreements/${agreementId}?notice=cancelled`);
}

export async function openDisputeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  const agreementId = id(fd, "agreementId");
  const reason = str(fd, "reason").trim();
  if (reason.length < 20) return { errors: { reason: "Explain what went wrong against the agreed terms (20+ characters)." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("open_dispute", { p_agreement_id: agreementId, p_reason: reason });
  if (error) return { errors: { form: friendly(error, "We couldn't open a dispute. Please try again.") } };
  after([`/dashboard/agreements/${agreementId}`]);
  redirect(`/dashboard/agreements/${agreementId}?notice=disputed`);
}

// ------------------------------------------------------------------ requester opt-in
export async function setPaidTaskOptInAction(fd: FormData) {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/tasks" });
  const open = str(fd, "open") === "true";
  const supabase = await createClient();
  const { data: existing } = await supabase.from("support_preferences").select("user_id").eq("user_id", viewer.id).maybeSingle();
  const { error } = existing
    ? await supabase.from("support_preferences").update({ open_to_paid_tasks: open }).eq("user_id", viewer.id)
    : await supabase.from("support_preferences").insert({ user_id: viewer.id, open_to_paid_tasks: open });
  revalidatePath("/dashboard/requester/tasks");
  redirect(`/dashboard/requester/tasks?notice=${error ? "error" : open ? "opted-in" : "opted-out"}`);
}
