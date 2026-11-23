import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

run("integration: real Auth + PostgREST + Storage", () => {
  let req: Awaited<ReturnType<typeof member>>;
  let sup: Awaited<ReturnType<typeof member>>;
  let mod: Awaited<ReturnType<typeof member>>;
  let adm: Awaited<ReturnType<typeof member>>;
  let needId: string;
  let path: string;

  beforeAll(async () => {
    req = await member("Requester", "need");
    sup = await member("Supporter", "help");
    mod = await member("Moderator", "help");
    adm = await member("Admin", "help");
    await sql("insert into public.user_roles (user_id, role) values ($1, 'moderator'), ($2, 'admin')", [mod.id, adm.id]);
    await sql("update public.rate_limit_rules set max_hits = 1000 where scope = 'user'");
    needId = await draftNeed(req.sb, req.id, `Integration need ${Date.now()}`);
    path = `${req.id}/${needId}/evidence.pdf`;
  }, 60_000);

  afterAll(async () => {
    await sql("update public.rate_limit_rules r set max_hits = d.max_hits from (values ('submit_need',5),('create_need',30),('submit_report',10),('upload_evidence',30),('save_need',200),('update_profile',60),('set_role',20),('block_user',30)) d(action,max_hits) where r.action = d.action");
  });

  // ------------------------------------------------------------ PostgREST
  describe("API boundary (PostgREST)", () => {
    it("does not expose role switching, config or private schemas over HTTP", async () => {
      const sb = sup.sb;
      const setConfig = await sb.rpc("set_config" as never, { setting_name: "role", new_value: "postgres", is_local: true } as never);
      expect(setConfig.error).not.toBeNull();
      const res = await fetch(`${URL_}/rest/v1/app_secrets`, { headers: { apikey: ANON, "Accept-Profile": "private" } });
      expect(res.status).toBeGreaterThanOrEqual(400);
      const hit = await fetch(`${URL_}/rest/v1/rpc/hit`, { method: "POST", headers: { apikey: ANON, "Content-Profile": "private", "Content-Type": "application/json" }, body: "{}" });
      expect(hit.status).toBeGreaterThanOrEqual(400);
    });

    it("internal functions are not callable over HTTP", async () => {
      const r1 = await sup.sb.rpc("log_audit" as never, { p_action: "x.y", p_entity_type: "z", p_entity_id: null, p_metadata: {} } as never);
      const r2 = await sup.sb.rpc("check_rate_limit" as never, { p_action: "submit_need", p_max: 1000, p_window_seconds: 1 } as never);
      expect(r1.error).not.toBeNull();
      expect(r2.error).not.toBeNull();
    });

    it("anonymous visitors cannot write through the public view", async () => {
      const anon = client();
      const r = await anon.from("needs_public").update({ title: "pwned" } as never).neq("id", "00000000-0000-0000-0000-000000000000");
      expect(r.error).not.toBeNull();
    });
  });

  // ----------------------------------------------------------- RLS by role
  describe("row-level security with real sessions", () => {
    it("a draft is visible only to its owner", async () => {
      const own = await req.sb.from("needs").select("id").eq("id", needId);
      const other = await sup.sb.from("needs").select("id").eq("id", needId);
      const anon = await client().from("needs").select("id").eq("id", needId);
      expect([own.data?.length, other.data?.length, anon.data?.length]).toEqual([1, 0, 0]);
    });

    it("a supporter cannot create needs and nobody can write protected columns", async () => {
      const ins = await sup.sb.from("needs").insert({ requester_id: sup.id, title: "Supporter need", category_slug: "education" });
      expect(ins.error).not.toBeNull();
      const upd = await req.sb.from("needs").update({ status: "published" } as never).eq("id", needId);
      expect(upd.error).not.toBeNull();
    });

    it("staff roles do nothing until MFA is completed (aal1), then work (aal2)", async () => {
      const audit1 = await adm.sb.from("audit_events").select("id").limit(1);
      expect(audit1.data).toEqual([]);
      const stats1 = await mod.sb.rpc("moderation_stats");
      expect(stats1.error?.message).toMatch(/Moderator role/);

      await enrolMfa(mod.sb);
      await enrolMfa(adm.sb);
      const { data: claims } = await mod.sb.auth.getClaims();
      expect((claims?.claims as { aal?: string }).aal).toBe("aal2");

      const stats2 = await mod.sb.rpc("moderation_stats");
      expect(stats2.error).toBeNull();
      const audit2 = await adm.sb.from("audit_events").select("id").limit(1);
      expect(audit2.data?.length).toBe(1);
    });

    it("MFA factor enrolment is written to the audit log", async () => {
      const rows = await sql("select action from public.audit_events where actor_id = $1 and action like 'mfa.%'", [mod.id]);
      expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(["mfa.factor_enrolled"]));
    });
  });

  // ---------------------------------------------------------------- Storage
  describe("evidence storage (real Storage API)", () => {
    it("owner uploads a PDF to their own draft", async () => {
      const r = await req.sb.storage.from("need-evidence").upload(path, PDF, { contentType: "application/pdf" });
      expect(r.error).toBeNull();
      const row = await req.sb.from("need_evidence").insert({
        need_id: needId, owner_id: req.id, storage_path: path, file_name: "evidence.pdf", mime_type: "application/pdf", size_bytes: PDF.length,
      });
      expect(row.error).toBeNull();
    });

    it("rejects disallowed file types and oversized files at the bucket", async () => {
      const txt = await req.sb.storage.from("need-evidence").upload(`${req.id}/${needId}/notes.txt`, Buffer.from("hello"), { contentType: "text/plain" });
      expect(txt.error).not.toBeNull();
      const big = await req.sb.storage.from("need-evidence").upload(`${req.id}/${needId}/big.pdf`, Buffer.alloc(10 * 1024 * 1024 + 1, 1), { contentType: "application/pdf" });
      expect(big.error).not.toBeNull();
    });

    it("another member cannot upload into the owner's folder or read the file", async () => {
      const up = await sup.sb.storage.from("need-evidence").upload(`${req.id}/${needId}/intruder.pdf`, PDF, { contentType: "application/pdf" });
      expect(up.error).not.toBeNull();
      const signed = await sup.sb.storage.from("need-evidence").createSignedUrl(path, 60);
      expect(signed.error).not.toBeNull();
      const dl = await sup.sb.storage.from("need-evidence").download(path);
      expect(dl.error).not.toBeNull();
      const anonDl = await client().storage.from("need-evidence").download(path);
      expect(anonDl.error).not.toBeNull();
      const pub = await fetch(`${URL_}/storage/v1/object/public/need-evidence/${path}`);
      expect(pub.status).toBeGreaterThanOrEqual(400);
    });

    it("the owner's signed URL works, then expires", async () => {
      const { data, error } = await req.sb.storage.from("need-evidence").createSignedUrl(path, 2);
      expect(error).toBeNull();
      const ok = await fetch(data!.signedUrl);
      expect(ok.status).toBe(200);
      expect(Buffer.from(await ok.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF");
      await new Promise((r) => setTimeout(r, 3500));
      const expired = await fetch(data!.signedUrl);
      expect(expired.status).toBeGreaterThanOrEqual(400);
    });

    it("a moderator cannot read draft evidence, even with MFA", async () => {
      const rpc = await mod.sb.rpc("authorise_evidence_access", { p_evidence_id: (await sql<{ id: string }>("select id from public.need_evidence where storage_path = $1", [path]))[0].id });
      expect(rpc.error).not.toBeNull();
      const signed = await mod.sb.storage.from("need-evidence").createSignedUrl(path, 60);
      expect(signed.error).not.toBeNull();
    });

    it("during review a moderator can open it only through an audit-logged grant, which expires", async () => {
      const sub = await req.sb.rpc("submit_need", { p_need_id: needId });
      expect(sub.error).toBeNull();
      const before = await mod.sb.storage.from("need-evidence").createSignedUrl(path, 60);
      expect(before.error).not.toBeNull(); // no grant yet

      const [{ id: evidenceId }] = await sql<{ id: string }>("select id from public.need_evidence where storage_path = $1", [path]);
      const grant = await mod.sb.rpc("authorise_evidence_access", { p_evidence_id: evidenceId });
      expect(grant.error).toBeNull();
      const signed = await mod.sb.storage.from("need-evidence").createSignedUrl(path, 60);
      expect(signed.error).toBeNull();
      expect((await fetch(signed.data!.signedUrl)).status).toBe(200);

      const logged = await sql("select 1 from public.audit_events where action = 'evidence.viewed' and actor_id = $1 and entity_id = $2", [mod.id, needId]);
      expect(logged.length).toBe(1);

      await sql("update public.evidence_access_grants set expires_at = now() - interval '1 second' where user_id = $1", [mod.id]);
      const after = await mod.sb.storage.from("need-evidence").createSignedUrl(path, 60);
      expect(after.error).not.toBeNull();
    });

    it("once submitted, the owner can no longer delete the evidence; drafts can", async () => {
      // Storage reports success with an empty list when RLS filters the delete, so check the object itself.
      await req.sb.storage.from("need-evidence").remove([path]);
      const still = await sql("select 1 from storage.objects where bucket_id = 'need-evidence' and name = $1", [path]);
      expect(still.length).toBe(1);

      const draft2 = await draftNeed(req.sb, req.id, `Draft for delete test ${Date.now()}`);
      const p2 = `${req.id}/${draft2}/scan.pdf`;
      expect((await req.sb.storage.from("need-evidence").upload(p2, PDF, { contentType: "application/pdf" })).error).toBeNull();
      const del2 = await req.sb.storage.from("need-evidence").remove([p2]);
      expect(del2.error).toBeNull();
      const gone = await sql("select 1 from storage.objects where bucket_id = 'need-evidence' and name = $1", [p2]);
      expect(gone.length).toBe(0);
    });
  });

  // -------------------------------------------------------------- sessions
  describe("sessions", () => {
    it("signing out other sessions revokes them server-side", async () => {
      const a = client();
      const b = client();
      await a.auth.signInWithPassword({ email: sup.email, password: PASSWORD });
      await b.auth.signInWithPassword({ email: sup.email, password: PASSWORD });
      expect((await b.auth.getUser()).error).toBeNull();
      await a.auth.signOut({ scope: "others" });
      expect((await b.auth.getUser()).error).not.toBeNull();
      const refresh = await b.auth.refreshSession();
      expect(refresh.error).not.toBeNull();
      expect((await a.auth.getUser()).error).toBeNull();
    });

    it("global sign-out revokes every session including the current one", async () => {
      const a = client();
      await a.auth.signInWithPassword({ email: sup.email, password: PASSWORD });
      const token = (await a.auth.getSession()).data.session!.access_token;
      await a.auth.signOut({ scope: "global" });
      // The old access token is rejected by the Auth server once its session is revoked.
      const check = await client().auth.getUser(token);
      expect(check.error).not.toBeNull();
    });

    it("an MFA-enrolled member signs in at aal1 and must verify to reach aal2", async () => {
      const c = client();
      await c.auth.signInWithPassword({ email: mod.email, password: PASSWORD });
      const level = await c.auth.mfa.getAuthenticatorAssuranceLevel();
      expect(level.data).toMatchObject({ currentLevel: "aal1", nextLevel: "aal2" });
      const blocked = await c.rpc("moderation_stats");
      expect(blocked.error).not.toBeNull();
    });
  });
});
