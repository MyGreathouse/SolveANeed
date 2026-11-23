import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { Client } from "pg";
import type { Database } from "@/lib/supabase/database.types";
import { totp } from "../support/totp";

/**
 * Integration tests against a REAL Supabase-compatible stack:
 * GoTrue (Auth) + PostgREST + Supabase Storage API + Postgres.
 * Every request uses a genuine signed-in session over HTTP.
 *
 * Env: INT_SUPABASE_URL, INT_ANON_KEY, INT_SERVICE_ROLE_KEY (test stack only!),
 *      INT_DATABASE_URL (superuser, used only for setup/inspection).
 */
const URL_ = process.env.INT_SUPABASE_URL;
const ANON = process.env.INT_ANON_KEY ?? "";
const SERVICE = process.env.INT_SERVICE_ROLE_KEY ?? "";
const DB_URL = process.env.INT_DATABASE_URL;
const run = URL_ && DB_URL ? describe : describe.skip;

type SB = SupabaseClient<Database>;
const PASSWORD = "Integration-Test-Pass-42";
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

function client(): SB {
  return createClient<Database>(URL_!, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function sql<T = Record<string, unknown>>(q: string, p: unknown[] = []): Promise<T[]> {
  const c = new Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(q, p)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Creates a confirmed user through the Auth admin API and returns a signed-in client. */
async function member(name: string, intent: "need" | "help" | "both"): Promise<{ sb: SB; id: string; email: string }> {
  const admin = createClient(URL_!, SERVICE, { auth: { persistSession: false } });
  const email = `int-${name.toLowerCase().replace(/\W/g, "")}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: name, intent, age_confirmed: "true", terms_accepted: "true" },
  });
  if (error) throw error;
  const sb = client();
  const signIn = await sb.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { sb, id: data.user.id, email };
}

/** Enrols TOTP for a signed-in client and upgrades the session to aal2. Returns the secret. */
async function enrolMfa(sb: SB): Promise<string> {
  const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: `int-${Date.now()}` });
  if (error) throw error;
  const v = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) });
  if (v.error) throw v.error;
  return data.totp.secret;
}

async function draftNeed(sb: SB, requesterId: string, title: string): Promise<string> {
  const { data, error } = await sb
    .from("needs")
    .insert({
      requester_id: requesterId,
      title,
      category_slug: "skills-training",
      description: "I have a confirmed place on an accredited course and need help covering the cost of the required equipment for it.",
      amount_minor: 45000,
      currency: "GBP",
      intended_use: "Buying the equipment listed in the course joining instructions.",
      accepted_support_types: ["gift"],
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}


/**
 * Phase 3 over real HTTP: offers and agreements through PostgREST RPCs, and
 * conversation files through the real Storage API and its RLS policies.
 */
run("integration: offers, messaging and files (Phase 3)", () => {
  let req: Awaited<ReturnType<typeof member>>;
  let sup: Awaited<ReturnType<typeof member>>;
  let out: Awaited<ReturnType<typeof member>>;
  let mod: Awaited<ReturnType<typeof member>>;
  let offerId: string;
  let conv: string;
  let filePath: string;
  let fileId: string;

  beforeAll(async () => {
    req = await member("Requester3", "need");
    sup = await member("Supporter3", "help");
    out = await member("Outsider3", "both");
    mod = await member("Moderator3", "help");
    await sql("insert into public.user_roles (user_id, role) values ($1, 'moderator')", [mod.id]);
    await sql("update public.rate_limit_rules set max_hits = 1000 where scope = 'user'");
    const needId = await draftNeed(req.sb, req.id, `Phase 3 integration need ${Date.now()}`);
    await sql("update public.needs set accepted_support_types = '{gift,paid_task}' where id = $1", [needId]);
    await sql("update public.needs set status = 'pending_review', submitted_at = now() where id = $1", [needId]);
    await sql("update public.needs set status = 'published', published_at = now() where id = $1", [needId]);
    const { data, error } = await sup.sb.rpc("create_offer", { p_need_id: needId, p_type: "gift", p_amount_minor: 2500, p_terms: { message: "Good luck" } });
    if (error) throw error;
    offerId = (data as { offer_id: string }).offer_id;
    conv = (await sql<{ id: string }>("select id from public.conversations where offer_id = $1", [offerId]))[0].id;
    filePath = `${conv}/${sup.id}/quote.pdf`;
  }, 60_000);

  it("the offer is visible to its parties only", async () => {
    expect((await req.sb.from("offers").select("id").eq("id", offerId)).data).toHaveLength(1);
    expect((await out.sb.from("offers").select("id").eq("id", offerId)).data).toHaveLength(0);
    const direct = await sup.sb.from("offers").update({ amount_minor: 1 }).eq("id", offerId).select();
    expect(direct.error?.code ?? (direct.data?.length === 0 ? "no-rows" : "updated")).not.toBe("updated");
  });

  it("a party uploads to their own folder; outsiders can neither upload nor read", async () => {
    expect((await sup.sb.storage.from("conversation-files").upload(filePath, PDF, { contentType: "application/pdf" })).error).toBeNull();
    const reg = await sup.sb.rpc("register_conversation_file", { p_conversation_id: conv, p_storage_path: filePath, p_file_name: "quote.pdf" });
    expect(reg.error).toBeNull();
    fileId = reg.data as string;
    expect((await req.sb.storage.from("conversation-files").createSignedUrl(filePath, 60)).error).toBeNull();
    expect((await out.sb.storage.from("conversation-files").createSignedUrl(filePath, 60)).error).not.toBeNull();
    expect((await out.sb.storage.from("conversation-files").upload(`${conv}/${out.id}/x.pdf`, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
    // A party cannot write into the other party's folder.
    expect((await req.sb.storage.from("conversation-files").upload(`${conv}/${sup.id}/spoof.pdf`, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
    // Members cannot delete sent files (kept for disputes).
    await sup.sb.storage.from("conversation-files").remove([filePath]);
    expect(await sql("select 1 from storage.objects where bucket_id = 'conversation-files' and name = $1", [filePath])).toHaveLength(1);
  });

  it("a moderator with MFA cannot open the file outside a case, and only via a logged grant inside one", async () => {
    await enrolMfa(mod.sb);
    expect((await mod.sb.storage.from("conversation-files").createSignedUrl(filePath, 60)).error).not.toBeNull();
    expect((await mod.sb.rpc("authorise_conversation_file", { p_file_id: fileId })).error).not.toBeNull();
    const msg = await sup.sb.rpc("send_message", { p_conversation_id: conv, p_body: "Quote attached", p_file_id: fileId });
    expect(msg.error).toBeNull();
    const mid = (msg.data as { message_id: string }).message_id;
    expect((await req.sb.rpc("submit_report", { p_target_type: "message", p_target_id: mid, p_reason: "inappropriate", p_details: "" })).error).toBeNull();
    const auth = await mod.sb.rpc("authorise_conversation_file", { p_file_id: fileId });
    expect(auth.error).toBeNull();
    expect((await mod.sb.storage.from("conversation-files").createSignedUrl(filePath, 60)).error).toBeNull();
    expect(await sql("select 1 from public.audit_events where action = 'file.viewed' and actor_id = $1", [mod.id])).toHaveLength(1);
  });

  it("blocking stops uploads and messages over the API", async () => {
    expect((await req.sb.rpc("block_user", { p_user_id: sup.id, p_reason: "test" })).error).toBeNull();
    expect((await sup.sb.storage.from("conversation-files").upload(`${conv}/${sup.id}/after-block.pdf`, PDF, { contentType: "application/pdf" })).error).not.toBeNull();
    const m = await sup.sb.rpc("send_message", { p_conversation_id: conv, p_body: "Hello?", p_file_id: null as unknown as string });
    expect(m.error?.message).toMatch(/cannot message this member/);
    expect((await sup.sb.from("messages").select("id").eq("conversation_id", conv)).data).toHaveLength(1);
  });

  it("run_jobs needs the server token over HTTP and delivers notifications", async () => {
    expect((await out.sb.rpc("run_jobs", { p_server_token: "wrong" })).error?.message).toMatch(/Invalid server token/);
    const token = process.env.STACK_RATE_LIMIT_TOKEN ?? "e2e-rate-limit-token";
    const r = await client().rpc("run_jobs", { p_server_token: token });
    expect(r.error).toBeNull();
    const n = await req.sb.from("notifications").select("title").eq("type", "offer_received");
    expect(n.data?.length).toBeGreaterThan(0);
  });
});
