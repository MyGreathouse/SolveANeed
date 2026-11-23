import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  TEST_DATABASE_URL, anon, as, connect, createDraftNeed, createUser, expectPgError, grantRole, rebuildDatabase, user,
} from "./helpers";

const run = TEST_DATABASE_URL ? describe : describe.skip;

run("database policies (RLS, grants, triggers)", () => {
  let db: Client;
  let requester: string;
  let supporter: string;
  let other: string;
  let moderator: string;
  let admin: string;

  beforeAll(async () => {
    await rebuildDatabase();
    db = await connect();
    requester = await createUser(db, { display_name: "Amara", intent: "need" });
    supporter = await createUser(db, { display_name: "Ben", intent: "help" });
    other = await createUser(db, { display_name: "Chidi", intent: "both" });
    moderator = await createUser(db, { display_name: "Mod", intent: "help" });
    admin = await createUser(db, { display_name: "Admin", intent: "help" });
    await grantRole(db, moderator, "moderator");
    await grantRole(db, admin, "admin");
    // The suite reuses a few accounts heavily; the dedicated rate-limit test restores the real limit.
    await db.query("update public.rate_limit_rules set max_hits = 1000 where action in ('submit_need', 'create_need')");
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  async function publish(needId: string, ownerId = requester) {
    await as(db, user(ownerId), (q) => q("select public.submit_need($1)", [needId]), true);
    await as(db, user(moderator), (q) => q("select public.moderate_need($1, 'approve', null)", [needId]), true);
  }

  // ---------------------------------------------------------------- accounts
  describe("accounts and roles", () => {
    it("rejects sign-up without the 18+ attestation", async () => {
      await expectPgError(createUser(db, { age_confirmed: "false" }), "aged 18 and over");
    });

    it("rejects sign-up without accepting terms", async () => {
      await expectPgError(createUser(db, { terms_accepted: "false" }), "Terms must be accepted");
    });

    it("assigns roles from the sign-up intent", async () => {
      const { rows } = await db.query("select role from public.user_roles where user_id = $1", [requester]);
      expect(rows.map((r) => r.role)).toEqual(["requester"]);
    });

    it("prevents users editing protected profile fields", async () => {
      await expectPgError(
        as(db, user(requester), (q) => q("update public.profiles set account_status = 'active' where id = $1", [requester])),
        "permission denied",
      );
      await expectPgError(
        as(db, user(requester), (q) =>
          q("update public.profiles set identity_verified_at = now() where id = $1", [requester])),
        "permission denied",
      );
    });

    it("lets users edit their own self-service fields only", async () => {
      const own = await as(db, user(requester), (q) =>
        q("update public.profiles set bio = 'Hello' where id = $1", [requester]));
      expect(own.rowCount).toBe(1);
      const others = await as(db, user(requester), (q) =>
        q("update public.profiles set bio = 'Hacked' where id = $1", [supporter]));
      expect(others.rowCount).toBe(0);
    });

    it("hides other users' private profiles and offers no member directory", async () => {
      const priv = await as(db, user(supporter), (q) => q("select * from public.profiles where id = $1", [requester]));
      expect(priv.rowCount).toBe(0);
      const viewGone = await db.query("select to_regclass('public.public_profiles') as v");
      expect(viewGone.rows[0].v).toBeNull();
    });

    it("blocks privilege escalation through roles", async () => {
      await expectPgError(
        as(db, user(requester), (q) => q("insert into public.user_roles (user_id, role) values ($1, 'admin')", [requester])),
        "permission denied",
      );
      await expectPgError(
        as(db, user(requester), (q) => q("select public.set_my_role('admin', true)")),
        "administrator",
      );
      await expectPgError(
        as(db, user(moderator), (q) => q("select public.admin_set_role($1, 'admin', true)", [moderator])),
        "Administrator role required",
      );
    });

    it("allows self-service requester/supporter roles", async () => {
      const roles = await as(db, user(supporter), async (q) => {
        await q("select public.set_my_role('requester', true)");
        return q("select role from public.user_roles where user_id = $1 order by role", [supporter]);
      });
      expect(roles.rows.map((r) => r.role)).toEqual(["requester", "supporter"]);
    });
  });

  // ------------------------------------------------------------------- needs
  describe("needs", () => {
    it("only lets requesters create needs, as drafts, for themselves", async () => {
      await expectPgError(createDraftNeed(db, supporter), "row-level security");
      await expectPgError(
        as(db, user(requester), (q) =>
          q("insert into public.needs (requester_id, title, category_slug) values ($1, 'Someone else', 'education')", [other])),
        "row-level security",
      );
      await expectPgError(
        as(db, user(requester), (q) =>
          q("insert into public.needs (requester_id, title, category_slug, status) values ($1, 'Sneaky publish', 'education', 'published')", [requester])),
        "permission denied",
      );
    });

    it("rejects currencies that are not enabled", async () => {
      await expectPgError(createDraftNeed(db, requester, { currency: "JPY", amount_minor: 100000 }), "not currently available");
    });

    it("keeps drafts private to their owner", async () => {
      const id = await createDraftNeed(db, requester);
      const asAnon = await as(db, anon, (q) => q("select id from public.needs where id = $1", [id]));
      const asOther = await as(db, user(other), (q) => q("select id from public.needs where id = $1", [id]));
      const asOwner = await as(db, user(requester), (q) => q("select id from public.needs where id = $1", [id]));
      const asMod = await as(db, user(moderator), (q) => q("select id from public.needs where id = $1", [id]));
      expect([asAnon.rowCount, asOther.rowCount, asOwner.rowCount, asMod.rowCount]).toEqual([0, 0, 1, 1]);
    });

    it("prevents owners changing status or moderation fields directly", async () => {
      const id = await createDraftNeed(db, requester);
      await expectPgError(
        as(db, user(requester), (q) => q("update public.needs set status = 'published' where id = $1", [id])),
        "permission denied",
      );
      await expectPgError(
        as(db, user(requester), (q) => q("update public.needs set funded_minor = 99999 where id = $1", [id])),
        "permission denied",
      );
    });

    it("prevents other users editing or deleting someone else's need", async () => {
      const id = await createDraftNeed(db, requester);
      const upd = await as(db, user(other), (q) => q("update public.needs set title = 'Hijacked title' where id = $1", [id]));
      const del = await as(db, user(other), (q) => q("delete from public.needs where id = $1", [id]));
      expect([upd.rowCount, del.rowCount]).toEqual([0, 0]);
    });

    it("validates completeness on submission", async () => {
      const id = await createDraftNeed(db, requester, { description: "Too short" });
      await expectPgError(
        as(db, user(requester), (q) => q("select public.submit_need($1)", [id])),
        "Description must be at least 80 characters",
      );
      const tooBig = await createDraftNeed(db, requester, { amount_minor: 999_999_999, title: "A very expensive request" });
      await expectPgError(
        as(db, user(requester), (q) => q("select public.submit_need($1)", [tooBig])),
        "outside the allowed range",
      );
    });

    it("locks content once submitted and publishes only via moderation", async () => {
      const id = await createDraftNeed(db, requester, { title: "Tools for a carpentry apprenticeship" });
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [id]), true);
      const edit = await as(db, user(requester), (q) => q("update public.needs set title = 'Changed after submit' where id = $1", [id]));
      expect(edit.rowCount).toBe(0);

      await expectPgError(
        as(db, user(supporter), (q) => q("select public.moderate_need($1, 'approve', null)", [id])),
        /Moderator role/,
      );
      await as(db, user(moderator), (q) => q("select public.moderate_need($1, 'approve', null)", [id]), true);
      const pub = await as(db, anon, (q) => q("select id, requester_name from public.needs_public where id = $1", [id]));
      expect(pub.rowCount).toBe(1);
      expect(pub.rows[0].requester_name).toBe("Amara");

      const note = await db.query("select count(*)::int as n from public.notifications where user_id = $1", [requester]);
      expect(note.rows[0].n).toBeGreaterThan(0);
      const audit = await db.query("select count(*)::int as n from public.audit_events where entity_id = $1", [id]);
      expect(audit.rows[0].n).toBe(2);
    });

    it("requires a note when requesting changes and blocks self-moderation", async () => {
      const id = await createDraftNeed(db, moderator === requester ? other : requester, { title: "Business plan support for a bakery" });
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [id]), true);
      await expectPgError(
        as(db, user(moderator), (q) => q("select public.moderate_need($1, 'request_changes', '')", [id])),
        "note explaining",
      );
      await grantRole(db, moderator, "requester");
      const own = await createDraftNeed(db, moderator, { title: "Moderator's own personal need" });
      await as(db, user(moderator), (q) => q("select public.submit_need($1)", [own]), true);
      await expectPgError(
        as(db, user(moderator), (q) => q("select public.moderate_need($1, 'approve', null)", [own])),
        "cannot moderate your own",
      );
    });

    it("hides members-only needs from anonymous visitors", async () => {
      const id = await createDraftNeed(db, requester, { title: "Members only community garden", visibility: "members_only" });
      await publish(id);
      const a = await as(db, anon, (q) => q("select id from public.needs_public where id = $1", [id]));
      const m = await as(db, user(supporter), (q) => q("select id from public.needs_public where id = $1", [id]));
      expect([a.rowCount, m.rowCount]).toEqual([0, 1]);
    });

    it("blocks duplicate active titles from the same requester", async () => {
      const t = "Exam fees for an accountancy qualification";
      const a = await createDraftNeed(db, requester, { title: t });
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [a]), true);
      const b = await createDraftNeed(db, requester, { title: t });
      await expectPgError(as(db, user(requester), (q) => q("select public.submit_need($1)", [b])), "already have an active need");
    });

    it("rate-limits submissions", async () => {
      const ids: string[] = [];
      for (let i = 0; i < 6; i++) ids.push(await createDraftNeed(db, other, { title: `Rate limit test need number ${i}` }));
      await grantRole(db, other, "requester");
      await db.query("update public.rate_limit_rules set max_hits = 5 where action = 'submit_need'");
      let failures = 0;
      for (const id of ids) {
        try {
          await as(db, user(other), (q) => q("select public.submit_need($1)", [id]), true);
        } catch (e) {
          if ((e as Error).message.includes("Too many submissions")) failures++;
        }
      }
      await db.query("update public.rate_limit_rules set max_hits = 1000 where action = 'submit_need'");
      expect(failures).toBeGreaterThanOrEqual(1);
    });

    it("only allows saving published needs", async () => {
      const draft = await createDraftNeed(db, requester, { title: "Draft that cannot be saved" });
      await expectPgError(
        as(db, user(supporter), (q) => q("insert into public.saved_needs (user_id, need_id) values ($1, $2)", [supporter, draft])),
        "row-level security",
      );
    });
  });

  // ---------------------------------------------------------------- evidence
  describe("private evidence", () => {
    it("restricts evidence rows and storage objects to owner and staff", async () => {
      const needId = await createDraftNeed(db, requester, { title: "Evidence privacy check need", description: "x".repeat(81) + " privacy check" });
      const path = `${requester}/${needId}/doc.pdf`;
      await as(db, user(requester), async (q) => {
        await q("insert into storage.objects (bucket_id, name, owner) values ('need-evidence', $1, $2)", [path, requester]);
        await q(
          "insert into public.need_evidence (need_id, owner_id, storage_path, file_name, mime_type, size_bytes) values ($1, $2, $3, 'doc.pdf', 'application/pdf', 1000)",
          [needId, requester, path],
        );
      }, true);

      const otherRows = await as(db, user(other), (q) => q("select * from public.need_evidence where need_id = $1", [needId]));
      const otherObjs = await as(db, user(other), (q) => q("select * from storage.objects where name = $1", [path]));
      // Drafts are not under review, so even moderators cannot see their evidence.
      const modDraft = await as(db, user(moderator), (q) => q("select * from public.need_evidence where need_id = $1", [needId]));
      expect([otherRows.rowCount, otherObjs.rowCount, modDraft.rowCount]).toEqual([0, 0, 0]);
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [needId]), true);
      const modReview = await as(db, user(moderator), (q) => q("select * from public.need_evidence where need_id = $1", [needId]));
      expect(modReview.rowCount).toBe(1);
      await expectPgError(as(db, anon, (q) => q("select * from public.need_evidence")), "permission denied");
    });

    it("authorises evidence access for owner and staff only, and audit-logs staff views", async () => {
      const needId = await createDraftNeed(db, requester, { title: "Evidence access logging need", description: "y".repeat(81) + " access logging" });
      const path = `${requester}/${needId}/proof.pdf`;
      const { rows } = await db.query(
        "insert into public.need_evidence (need_id, owner_id, storage_path, file_name, mime_type, size_bytes) values ($1, $2, $3, 'proof.pdf', 'application/pdf', 500) returning id",
        [needId, requester, path]);
      const evId = rows[0].id;
      await as(db, user(requester), (q) => q("select public.submit_need($1)", [needId]), true);
      const own = await as(db, user(requester), (q) => q("select public.authorise_evidence_access($1) as p", [evId]));
      expect(own.rows[0].p).toBe(path);
      await expectPgError(as(db, user(other), (q) => q("select public.authorise_evidence_access($1)", [evId])), "Not found");
      await as(db, user(moderator), (q) => q("select public.authorise_evidence_access($1)", [evId]), true);
      const logged = await db.query("select count(*)::int as n from public.audit_events where action = 'evidence.viewed' and entity_id = $1", [needId]);
      expect(logged.rows[0].n).toBe(1);
    });

    it("restricts moderation statistics to staff", async () => {
      await expectPgError(as(db, user(supporter), (q) => q("select public.moderation_stats()")), /Moderator role/);
      const r = await as(db, user(moderator), (q) => q("select public.moderation_stats() as s"));
      expect(r.rows[0].s).toHaveProperty("pending_needs");
    });

    it("prevents uploading into another user's folder", async () => {
      const needId = await createDraftNeed(db, requester, { title: "Folder spoofing check need" });
      await expectPgError(
        as(db, user(other), (q) =>
          q("insert into storage.objects (bucket_id, name, owner) values ('need-evidence', $1, $2)", [`${requester}/${needId}/x.pdf`, other])),
        "row-level security",
      );
    });
  });

  // -------------------------------------------------------------- audit etc
  describe("audit, reports and deletion", () => {
    it("keeps the audit log admin-readable and append-only", async () => {
      const asUser = await as(db, user(requester), (q) => q("select * from public.audit_events"));
      expect(asUser.rowCount).toBe(0);
      const asAdmin = await as(db, user(admin), (q) => q("select * from public.audit_events"));
      expect(asAdmin.rowCount).toBeGreaterThan(0);
      await expectPgError(
        as(db, user(admin), (q) => q("insert into public.audit_events (action, entity_type) values ('x.y', 'z')")),
        "permission denied",
      );
      await expectPgError(db.query("delete from public.audit_events"), "append-only");
      await expectPgError(
        as(db, user(requester), (q) => q("select public.log_audit('x.y', 'z', null, '{}')")),
        "permission denied",
      );
    });

    it("accepts reports from members and lets staff resolve them", async () => {
      const id = await as(db, user(supporter), async (q) => {
        const target = await q("select id from public.needs where status = 'published' and requester_id <> $1 limit 1", [supporter]);
        const r = await q("select public.submit_report('need', $1, 'misleading', 'Looks copied')", [target.rows[0].id]);
        return r.rows[0].submit_report as string;
      }, true);
      await expectPgError(
        as(db, user(supporter), (q) => q("select public.resolve_report($1, 'dismissed', 'no')", [id])),
        /Moderator role/,
      );
      await as(db, user(moderator), (q) => q("select public.resolve_report($1, 'dismissed', 'Not a duplicate')", [id]), true);
      const { rows } = await db.query("select status from public.reports where id = $1", [id]);
      expect(rows[0].status).toBe("dismissed");
    });

    it("anonymises the profile and withdraws needs on deletion request", async () => {
      const u = await createUser(db, { display_name: "Leaving User", intent: "need" });
      const draft = await createDraftNeed(db, u, { title: "Draft from a leaving user" });
      await as(db, user(u), (q) => q("select public.request_account_deletion()"), true);
      const p = await db.query("select display_name, account_status from public.profiles where id = $1", [u]);
      expect(p.rows[0]).toEqual({ display_name: "Deleted member", account_status: "deletion_requested" });
      const n = await db.query("select count(*)::int as n from public.needs where id = $1", [draft]);
      expect(n.rows[0].n).toBe(0);
      await expectPgError(createDraftNeed(db, u, { title: "Need after deletion request" }), "row-level security");
    });
  });

  // ------------------------------------------------------ money & agreements
  describe("money, offers and payments", () => {
    let needId: string;
    beforeAll(async () => {
      needId = await createDraftNeed(db, requester, { title: "Funding for a catering hygiene course" });
      await publish(needId);
    });

    it("rejects contributions in a different currency from the need", async () => {
      await expectPgError(
        db.query("insert into public.contributions (need_id, supporter_id, amount_minor, currency) values ($1, $2, 1000, 'USD')", [needId, supporter]),
        "must match the need currency",
      );
    });

    it("blocks live-mode payment records at the database level", async () => {
      await expectPgError(
        db.query(
          "insert into public.payment_transactions (provider, idempotency_key, kind, amount_minor, currency, livemode) values ('stripe', 'k1', 'contribution', 1000, 'GBP', true)"),
        "check constraint",
      );
    });

    it("enforces idempotency keys and refund ceilings", async () => {
      const { rows } = await db.query(
        "insert into public.payment_transactions (provider, idempotency_key, kind, amount_minor, currency) values ('sandbox', 'idem-1', 'contribution', 5000, 'GBP') returning id");
      await expectPgError(
        db.query("insert into public.payment_transactions (provider, idempotency_key, kind, amount_minor, currency) values ('sandbox', 'idem-1', 'contribution', 5000, 'GBP')"),
        "duplicate key",
      );
      await db.query("insert into public.refunds (payment_transaction_id, amount_minor, currency, reason, idempotency_key) values ($1, 3000, 'GBP', 'test', 'r1')", [rows[0].id]);
      await expectPgError(
        db.query("insert into public.refunds (payment_transaction_id, amount_minor, currency, reason, idempotency_key) values ($1, 3000, 'GBP', 'test', 'r2')", [rows[0].id]),
        "cannot exceed",
      );
    });

    it("rejects unverified provider webhooks and hides events from clients", async () => {
      await expectPgError(
        db.query("insert into public.provider_events (provider, event_id, event_type, payload, signature_verified) values ('stripe', 'evt_1', 'x', '{}', false)"),
        "check constraint",
      );
      await expectPgError(as(db, user(admin), (q) => q("select * from public.provider_events")), "permission denied");
    });

    it("enforces offer state transitions and immutable versions", async () => {
      const { rows } = await db.query(
        "insert into public.offers (need_id, requester_id, supporter_id, offer_type, amount_minor, currency, status) values ($1, $2, $3, 'paid_task', 30000, 'GBP', 'proposed') returning id",
        [needId, requester, supporter]);
      const offerId = rows[0].id;
      await expectPgError(db.query("update public.offers set status = 'completed' where id = $1", [offerId]), "Invalid offer status transition");
      await db.query("update public.offers set status = 'accepted', accepted_at = now(), accepted_version = 1 where id = $1", [offerId]);
      await expectPgError(db.query("update public.offers set amount_minor = 1 where id = $1", [offerId]), "immutable");

      const v = await db.query(
        "insert into public.offer_versions (offer_id, version, proposed_by, amount_minor, currency, terms) values ($1, 1, $2, 30000, 'GBP', '{}') returning id",
        [offerId, supporter]);
      await expectPgError(db.query("update public.offer_versions set amount_minor = 1 where id = $1", [v.rows[0].id]), "append-only");

      const otherSees = await as(db, user(other), (q) => q("select * from public.offers where id = $1", [offerId]));
      const partySees = await as(db, user(supporter), (q) => q("select * from public.offers where id = $1", [offerId]));
      expect([otherSees.rowCount, partySees.rowCount]).toEqual([0, 1]);
      await expectPgError(
        as(db, user(supporter), (q) => q("update public.offers set amount_minor = 1 where id = $1", [offerId])),
        "permission denied",
      );
    });

    it("rejects an offer whose currency differs from the need", async () => {
      await expectPgError(
        db.query("insert into public.offers (need_id, requester_id, supporter_id, offer_type, amount_minor, currency) values ($1, $2, $3, 'gift', 100, 'EUR')", [needId, requester, supporter]),
        "must match the need currency",
      );
    });
  });
});
