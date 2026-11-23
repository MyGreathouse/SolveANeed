import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  TEST_DATABASE_URL, anon, as, connect, createDraftNeed, createUser, expectPgError, grantRole, rebuildDatabase, user,
} from "./helpers";

/**
 * Adversarial tests (Phase 2.5). Each test attempts a specific bypass as a
 * real Supabase role and asserts it fails. See docs/SECURITY_AUDIT.md.
 */
const run = TEST_DATABASE_URL ? describe : describe.skip;

run("attack suite", () => {
  let db: Client;
  let requester: string;
  let supporter: string;
  let moderator: string;
  let moderator2: string;
  let admin: string;
  let published: string;

  async function publish(needId: string, owner = requester) {
    await as(db, user(owner), (q) => q("select public.submit_need($1)", [needId]), true);
    await as(db, user(moderator), (q) => q("select public.moderate_need($1, 'approve', null)", [needId]), true);
  }

  beforeAll(async () => {
    await rebuildDatabase();
    db = await connect();
    requester = await createUser(db, { display_name: "Req", intent: "need" });
    supporter = await createUser(db, { display_name: "Sup", intent: "help" });
    moderator = await createUser(db, { display_name: "Mod", intent: "help" });
    moderator2 = await createUser(db, { display_name: "Mod Two", intent: "help" });
    admin = await createUser(db, { display_name: "Admin", intent: "help" });
    await grantRole(db, moderator, "moderator");
    await grantRole(db, moderator2, "moderator");
    await grantRole(db, admin, "admin");
    await db.query("update public.rate_limit_rules set max_hits = 1000 where action in ('submit_need', 'create_need', 'submit_report')");
    published = await createDraftNeed(db, requester, { title: "Published need for attack tests" });
    await publish(published);
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  // ------------------------------------------------------------------ S1/S2
  describe("views (S1, S2)", () => {
    it("anonymous users cannot write through needs_public", async () => {
      const denied = /permission denied|cannot (update|delete from) view/;
      await expectPgError(as(db, anon, (q) => q("update public.needs_public set title = 'pwned'")), denied);
      await expectPgError(as(db, anon, (q) => q("delete from public.needs_public")), denied);
      await expectPgError(as(db, user(supporter), (q) => q("delete from public.needs_public")), denied);
    });

    it("no public view exposes profiles, and needs_public never leaks requester ids", async () => {
      const cols = await db.query(
        "select column_name from information_schema.columns where table_schema='public' and table_name='needs_public'");
      expect(cols.rows.map((r) => r.column_name)).not.toContain("requester_id");
      const views = await db.query(
        "select table_name from information_schema.views where table_schema='public'");
      expect(views.rows.map((r) => r.table_name)).toEqual(["needs_public"]);
    });

    it("the requester-name function answers only for published needs", async () => {
      const draft = await createDraftNeed(db, requester, { title: "Draft probed by anon" });
      const r = await as(db, anon, (q) => q("select * from public.need_requester_public($1)", [draft]));
      expect(r.rowCount).toBe(0);
    });

    it("no client role holds write privileges on any view", async () => {
      const r = await db.query(`select table_name, grantee, privilege_type from information_schema.role_table_grants
        where table_schema='public' and table_name in (select table_name from information_schema.views where table_schema='public')
          and grantee in ('anon','authenticated') and privilege_type <> 'SELECT'`);
      expect(r.rows).toEqual([]);
    });
  });

  // --------------------------------------------------------------------- S4
  describe("staff MFA enforced in the database (S4)", () => {
    it("a moderator without MFA (aal1) is treated as a normal member", async () => {
      const draft = await createDraftNeed(db, requester, { title: "Needs review by MFA moderator" });
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [draft]), true);
      await expectPgError(
        as(db, user(moderator, "aal1"), (q) => q("select public.moderate_need($1, 'approve', null)", [draft])),
        "Moderator role (with MFA) required",
      );
      const seen = await as(db, user(moderator, "aal1"), (q) => q("select id from public.needs where id = $1", [draft]));
      expect(seen.rowCount).toBe(0);
      const ok = await as(db, user(moderator, "aal2"), (q) => q("select id from public.needs where id = $1", [draft]));
      expect(ok.rowCount).toBe(1);
    });

    it("an admin without MFA cannot read the audit log, grant roles or change settings", async () => {
      const audit = await as(db, user(admin, "aal1"), (q) => q("select * from public.audit_events"));
      expect(audit.rowCount).toBe(0);
      await expectPgError(as(db, user(admin, "aal1"), (q) => q("select public.admin_set_role($1, 'admin', true)", [supporter])), "Administrator");
      await expectPgError(as(db, user(admin, "aal1"), (q) => q("select public.admin_set_platform_setting('require_staff_mfa', 'false')")), "Administrator");
    });

    it("members cannot forge staff status by changing settings", async () => {
      await expectPgError(as(db, user(supporter), (q) => q("update public.platform_settings set value = 'false'")), "permission denied");
      await expectPgError(as(db, user(supporter), (q) => q("select public.admin_set_platform_setting('require_staff_mfa', 'false')")), "Administrator");
    });

    it("my_roles() reveals the caller's raw roles so the app can route staff to MFA", async () => {
      const r = await as(db, user(moderator, "aal1"), (q) => q("select public.my_roles() as role"));
      expect(r.rows.map((x) => x.role)).toContain("moderator");
    });
  });

  // ----------------------------------------------------- privileged writes
  describe("direct writes cannot impersonate privileged RPCs", () => {
    // Role switching (SET ROLE) is only reachable with raw SQL access, which
    // clients never have: PostgREST exposes tables and RPCs only. That boundary
    // is tested over HTTP in tests/integration/postgrest-boundary.test.ts.

    it("cannot call internal functions", async () => {
      for (const sql of [
        "select public.log_audit('x.y', 'z', null, '{}')",
        "select public.notify_user(gen_random_uuid(), 't', 't', null, null)",
        "select public.check_rate_limit('submit_need', 1000, 1)",
        "select private.hit('k', 'submit_need')",
        "select public.is_blocked_between(gen_random_uuid(), gen_random_uuid())",
        "select public.purge_rate_limits()",
      ]) {
        await expectPgError(as(db, user(supporter), (q) => q(sql)), "permission denied");
      }
    });

    it("cannot write moderation, audit, risk or notification records directly", async () => {
      for (const sql of [
        `insert into public.moderation_actions (target_type, target_id, action) values ('need', '${published}', 'approve')`,
        `insert into public.risk_signals (entity_type, entity_id, signal) values ('need', '${published}', 'x')`,
        `insert into public.notifications (user_id, type, title) values ('${requester}', 't', 'Fake')`,
        `insert into public.evidence_access_grants (user_id, evidence_id, storage_path, expires_at) values ('${supporter}', gen_random_uuid(), 'x', now() + interval '1 day')`,
        `insert into public.rate_limits (key, window_start, hits) values ('x', now(), 0)`,
        `update public.rate_limit_rules set max_hits = 99999`,
      ]) {
        await expectPgError(as(db, user(supporter), (q) => q(sql)), "permission denied");
      }
    });

    it("cannot publish, fund or verify a need by direct update, even as its owner", async () => {
      const draft = await createDraftNeed(db, requester, { title: "Owner tries to self publish" });
      for (const col of ["status = 'published'", "funded_minor = 1", "evidence_reviewed_at = now()", "published_at = now()", "requester_id = gen_random_uuid()"]) {
        await expectPgError(as(db, user(requester), (q) => q(`update public.needs set ${col} where id = $1`, [draft])), "permission denied");
      }
    });

    it("cannot mark another member's notifications as read", async () => {
      const r = await as(db, user(supporter), (q) => q("update public.notifications set read_at = now() where user_id = $1", [requester]));
      expect(r.rowCount).toBe(0);
    });
  });

  // ------------------------------------------------------------ payments
  describe("payment and offer locks", () => {
    it("clients cannot create or change payment, payout, refund or contribution records", async () => {
      for (const sql of [
        "insert into public.payment_transactions (provider, idempotency_key, kind, amount_minor, currency) values ('sandbox','a','contribution',100,'GBP')",
        `insert into public.contributions (need_id, supporter_id, amount_minor, currency) values ('${published}', '${supporter}', 100, 'GBP')`,
        `insert into public.payouts (recipient_id, amount_minor, currency, idempotency_key) values ('${supporter}', 100, 'GBP', 'p')`,
        "insert into public.provider_events (provider, event_id, event_type, payload, signature_verified) values ('stripe','e','t','{}',true)",
        "update public.payment_transactions set status = 'succeeded'",
      ]) {
        await expectPgError(as(db, user(admin), (q) => q(sql)), "permission denied");
      }
    });

    it("even the database owner cannot record a live-mode payment or an unapproved paid payout", async () => {
      await expectPgError(
        db.query("insert into public.payment_transactions (provider, idempotency_key, kind, amount_minor, currency, livemode) values ('stripe','live-1','contribution',100,'GBP',true)"),
        "check constraint",
      );
      await expectPgError(
        db.query(`insert into public.payouts (recipient_id, amount_minor, currency, idempotency_key, status) values ('${requester}', 100, 'GBP', 'po-1', 'paid')`),
        "check constraint",
      );
    });

    it("clients cannot create offers or force offer transitions", async () => {
      await expectPgError(
        as(db, user(supporter), (q) =>
          q(`insert into public.offers (need_id, requester_id, supporter_id, offer_type, amount_minor, currency) values ($1, $2, $3, 'gift', 100, 'GBP')`, [published, requester, supporter])),
        "permission denied",
      );
      const { rows } = await db.query(
        "insert into public.offers (need_id, requester_id, supporter_id, offer_type, amount_minor, currency, status) values ($1,$2,$3,'paid_task',5000,'GBP','proposed') returning id",
        [published, requester, supporter]);
      await expectPgError(as(db, user(requester), (q) => q("update public.offers set status = 'accepted' where id = $1", [rows[0].id])), "permission denied");
      await expectPgError(db.query("update public.offers set status = 'completed' where id = $1", [rows[0].id]), "Invalid offer status transition");
    });
  });

  // ----------------------------------------------------------------- S3
  describe("evidence restricted to review cases (S3)", () => {
    let needId: string;
    let evidenceId: string;
    let path: string;

    beforeAll(async () => {
      needId = await createDraftNeed(db, requester, { title: "Evidence scope test need" });
      path = `${requester}/${needId}/scope.pdf`;
      await db.query("insert into storage.objects (bucket_id, name, owner) values ('need-evidence', $1, $2)", [path, requester]);
      const r = await db.query(
        "insert into public.need_evidence (need_id, owner_id, storage_path, file_name, mime_type, size_bytes) values ($1,$2,$3,'scope.pdf','application/pdf',10) returning id",
        [needId, requester, path]);
      evidenceId = r.rows[0].id;
    });

    it("staff cannot read evidence objects directly, even during review, without an audit-logged grant", async () => {
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [needId]), true);
      const direct = await as(db, user(moderator), (q) => q("select name from storage.objects where name = $1", [path]));
      expect(direct.rowCount).toBe(0);
      const viaRpc = await as(db, user(moderator), async (q) => {
        await q("select public.authorise_evidence_access($1)", [evidenceId]);
        return q("select name from storage.objects where name = $1", [path]);
      });
      expect(viaRpc.rowCount).toBe(1);
    });

    it("a grant expires", async () => {
      const r = await as(db, user(moderator), async (q) => {
        await q("select public.authorise_evidence_access($1)", [evidenceId]);
        return q("select name from storage.objects where name = $1", [path]);
      }, true);
      expect(r.rowCount).toBe(1);
      await db.query("update public.evidence_access_grants set expires_at = now() - interval '1 second' where user_id = $1", [moderator]);
      const after = await as(db, user(moderator), (q) => q("select name from storage.objects where name = $1", [path]));
      expect(after.rowCount).toBe(0);
    });

    it("once published (no open report), evidence is out of scope; an open report brings it back", async () => {
      await as(db, user(moderator), (q) => q("select public.moderate_need($1, 'approve', null)", [needId]), true);
      await expectPgError(as(db, user(moderator), (q) => q("select public.authorise_evidence_access($1)", [evidenceId])), "Not found");
      const rows = await as(db, user(moderator), (q) => q("select id from public.need_evidence where id = $1", [evidenceId]));
      expect(rows.rowCount).toBe(0);
      await as(db, user(supporter), (q) => q("select public.submit_report('need', $1, 'misleading', 'Check evidence')", [needId]), true);
      const ok = await as(db, user(moderator), (q) => q("select public.authorise_evidence_access($1) as p", [evidenceId]));
      expect(ok.rows[0].p).toBe(path);
    });

    it("the owner always retains access", async () => {
      const r = await as(db, user(requester), (q) => q("select name from storage.objects where name = $1", [path]));
      expect(r.rowCount).toBe(1);
    });
  });

  // ----------------------------------------------------------------- S5
  describe("account status changes (S5)", () => {
    it("a moderator cannot suspend another moderator or an admin; an admin can", async () => {
      await expectPgError(as(db, user(moderator), (q) => q("select public.admin_set_account_status($1, 'suspended', 'test')", [admin])), "Only an administrator");
      await expectPgError(as(db, user(moderator), (q) => q("select public.admin_set_account_status($1, 'suspended', 'test')", [moderator2])), "Only an administrator");
      await as(db, user(admin), (q) => q("select public.admin_set_account_status($1, 'suspended', 'test')", [moderator2]));
    });

    it("status cannot be set to deletion_requested by staff", async () => {
      await expectPgError(as(db, user(admin), (q) => q("select public.admin_set_account_status($1, 'deletion_requested', 'x')", [supporter])), "active or suspended");
    });
  });

  // ----------------------------------------------------------------- S6
  describe("rate limiting (S6)", () => {
    it("direct API inserts are limited in the database", async () => {
      await db.query("update public.rate_limit_rules set max_hits = 3 where action = 'save_need'");
      const n = await as(db, user(supporter), async (q) => {
        let blocked = 0;
        for (let i = 0; i < 5; i++) {
          try {
            await q("savepoint s");
            await q("delete from public.saved_needs where user_id = $1", [supporter]);
            await q("insert into public.saved_needs (user_id, need_id) values ($1, $2)", [supporter, published]);
            await q("release savepoint s");
          } catch (e) {
            await q("rollback to savepoint s");
            if ((e as Error).message.includes("Too many requests")) blocked++;
          }
        }
        return blocked;
      });
      expect(n).toBe(2);
      await db.query("update public.rate_limit_rules set max_hits = 200 where action = 'save_need'");
    });

    it("consume_rate_limit only accepts server-defined user actions", async () => {
      await expectPgError(as(db, user(supporter), (q) => q("select public.consume_rate_limit('made_up')")), "Unknown rate-limit action");
      await expectPgError(as(db, user(supporter), (q) => q("select public.consume_rate_limit('sign_in_ip')")), "Unknown rate-limit action");
      const ok = await as(db, user(supporter), (q) => q("select public.consume_rate_limit('set_role') as ok"));
      expect(ok.rows[0].ok).toBe(true);
    });

    it("anonymous limits require the server token, then enforce the rule", async () => {
      const subject = "a".repeat(64);
      const unconfigured = await as(db, anon, (q) => q("select public.consume_anon_rate_limit('password_reset_email', $1, 'x') as ok", [subject]));
      expect(unconfigured.rows[0].ok).toBeNull();
      await db.query("insert into private.app_secrets (name, value_hash) values ('rate_limit_server_token', encode(sha256('s3cret-token'::bytea), 'hex'))");
      await expectPgError(as(db, anon, (q) => q("select public.consume_anon_rate_limit('password_reset_email', $1, 'wrong')", [subject])), "Invalid server token");
      await expectPgError(as(db, anon, (q) => q("select public.consume_anon_rate_limit('password_reset_email', 'not-a-hash', 's3cret-token')")), "sha256");
      const results: boolean[] = [];
      for (let i = 0; i < 4; i++) {
        const r = await as(db, anon, (q) => q("select public.consume_anon_rate_limit('password_reset_email', $1, 's3cret-token') as ok", [subject]), true);
        results.push(r.rows[0].ok);
      }
      expect(results).toEqual([true, true, true, false]);
    });

    it("anonymous callers cannot read the secrets schema", async () => {
      await expectPgError(as(db, anon, (q) => q("select * from private.app_secrets")), "permission denied");
      await expectPgError(as(db, user(admin), (q) => q("select * from private.app_secrets")), "permission denied");
    });
  });

  // ----------------------------------------------------------------- S7
  describe("reports and moderation integrity (S7)", () => {
    it("rejects reports on non-existent or own needs", async () => {
      await expectPgError(as(db, user(supporter), (q) => q("select public.submit_report('need', gen_random_uuid(), 'other', null)")), "could not be found");
      await expectPgError(as(db, user(requester), (q) => q("select public.submit_report('need', $1, 'other', null)", [published])), "own need");
    });

    it("report status cannot move backwards and staff cannot resolve their own report", async () => {
      const id = (await as(db, user(moderator2 === supporter ? admin : supporter), (q) =>
        q("select public.submit_report('need', $1, 'duplicate', 'x') as id", [published]), true)).rows[0].id;
      await as(db, user(moderator), (q) => q("select public.resolve_report($1, 'dismissed', 'ok')", [id]), true);
      await expectPgError(as(db, user(moderator), (q) => q("select public.resolve_report($1, 'under_review', 'reopen')", [id])), "Invalid report status");
      const own = (await as(db, user(moderator), (q) => q("select public.submit_report('need', $1, 'misleading', 'mine') as id", [published]), true)).rows[0].id;
      await expectPgError(as(db, user(moderator), (q) => q("select public.resolve_report($1, 'dismissed', 'x')", [own])), "own report");
    });

    it("evidence can only be marked reviewed during review", async () => {
      await expectPgError(as(db, user(moderator), (q) => q("select public.moderate_need($1, 'mark_evidence_reviewed', null)", [published])), "during review");
    });
  });

  // ------------------------------------------------------- safeguarding
  describe("safeguarding: blocking and sensitive content", () => {
    it("members can block and unblock; blocks are private to the blocker", async () => {
      await expectPgError(as(db, user(requester), (q) => q("select public.block_user($1, null)", [requester])), "block yourself");
      await as(db, user(requester), (q) => q("select public.block_user($1, 'Pushy offers')", [supporter]), true);
      const mine = await as(db, user(requester), (q) => q("select * from public.my_blocked_users()"));
      expect(mine.rows.map((r) => r.display_name)).toEqual(["Sup"]);
      const theirs = await as(db, user(supporter), (q) => q("select * from public.user_blocks"));
      expect(theirs.rowCount).toBe(0);
      const between = await db.query("select public.is_blocked_between($1, $2) as b", [supporter, requester]);
      expect(between.rows[0].b).toBe(true);
      await as(db, user(requester), (q) => q("select public.unblock_user($1)", [supporter]), true);
    });

    it.each([
      ["Please send it to sort code 12-34-56", "bank_sort_code"],
      ["account number 12345678 at my bank", "bank_account_number"],
      ["Just PayPal me instead", "off_platform_payment"],
      ["message me on WhatsApp", "off_platform_contact"],
      ["my number is 07700 900123", "phone_number"],
      ["email me at jo@example.com", "email_address"],
      ["send your passport number", "sensitive_identifier"],
    ])("flags %j as %s", async (text, label) => {
      const r = await db.query("select public.detect_sensitive_content($1) as f", [text]);
      expect(r.rows[0].f).toContain(label);
    });

    it("does not flag ordinary need descriptions", async () => {
      const r = await db.query("select public.detect_sensitive_content($1) as f", [
        "I need a laptop for my 12 week course starting on 3 March 2027, costing £650 from a UK retailer.",
      ]);
      expect(r.rows[0].f).toEqual([]);
    });

    it("submitting a need containing bank details raises a reviewer signal", async () => {
      const id = await createDraftNeed(db, requester, {
        title: "Need with payment details inside",
        description: "Please help me pay for my course. You can send it directly by bank transfer to sort code 12-34-56 account number 12345678 to save time.",
      });
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [id]), true);
      const s = await db.query("select detail from public.risk_signals where entity_id = $1 and signal = 'sensitive_content'", [id]);
      expect(s.rows[0].detail.categories).toEqual(expect.arrayContaining(["bank_sort_code", "bank_account_number", "off_platform_payment"]));
    });
  });

  describe("default privileges (S8)", () => {
    it("functions created in future migrations are not executable by clients unless granted", async () => {
      await db.query("create function public.zz_future_fn() returns int language sql as 'select 1'");
      const r = await db.query("select has_function_privilege('anon', 'public.zz_future_fn()', 'execute') as a, has_function_privilege('authenticated', 'public.zz_future_fn()', 'execute') as b");
      expect(r.rows[0]).toEqual({ a: false, b: false });
      await db.query("create table public.zz_future_table (id int)");
      const t = await db.query("select has_table_privilege('anon', 'public.zz_future_table', 'select') as a");
      expect(t.rows[0].a).toBe(false);
      await db.query("drop function public.zz_future_fn(); drop table public.zz_future_table;");
    });
  });
});
