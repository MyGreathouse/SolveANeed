import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import {
  TEST_DATABASE_URL, as, connect, createDraftNeed, createUser, expectPgError, grantRole, rebuildDatabase, user,
} from "./helpers";

/**
 * Phase 3: offers, agreements, paid tasks, messaging, safety, notifications.
 * Every path runs as a real Supabase role through the public RPCs.
 */
const run = TEST_DATABASE_URL ? describe : describe.skip;

const ALL_TYPES = ["gift", "paid_task", "milestone", "direct_support"];
const tomorrowPlus = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const TASK = (over: Record<string, unknown> = {}) => ({
  title: "Design a logo for my bakery",
  description: "A simple, modern logo for a small home bakery, supplied as PNG and SVG.",
  deliverables: ["Three initial concepts", "Final logo as PNG and SVG"],
  deadline: tomorrowPlus(14),
  acceptance_criteria: "Logo delivered in both formats and matches the agreed concept.",
  max_revisions: 1,
  remote_only: true,
  ...over,
});

run("phase 3: offers, agreements and messaging", () => {
  let db: Client;
  let requester: string;
  let sup1: string;
  let sup2: string;
  let sup3: string;
  let outsider: string;
  let moderator: string;
  let need: string;
  let need2: string;

  const rpc = (who: string, sql: string, params: unknown[] = [], commit = true, aal: "aal1" | "aal2" = "aal2") =>
    as(db, user(who, aal), (q) => q(sql, params), commit);
  const one = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows[0];

  async function publish(id: string) {
    await rpc(requester, "select public.submit_need($1)", [id]);
    await rpc(moderator, "select public.moderate_need($1, 'approve', null)", [id]);
  }
  async function offer(who: string, needId: string, type: string, amount: number, terms: unknown) {
    const r = await rpc(who, "select public.create_offer($1, $2, $3, $4) as r", [needId, type, amount, JSON.stringify(terms)]);
    return r.rows[0].r as { offer_id: string; warnings: string[] };
  }
  async function convFor(offerId: string) {
    return (await one("select id from public.conversations where offer_id = $1", [offerId])).id as string;
  }

  beforeAll(async () => {
    await rebuildDatabase();
    db = await connect();
    requester = await createUser(db, { display_name: "Amara", intent: "need" });
    sup1 = await createUser(db, { display_name: "Ben", intent: "help" });
    sup2 = await createUser(db, { display_name: "Chloe", intent: "help" });
    sup3 = await createUser(db, { display_name: "Dev", intent: "help" });
    outsider = await createUser(db, { display_name: "Eve", intent: "both" });
    moderator = await createUser(db, { display_name: "Mod", intent: "help" });
    await grantRole(db, moderator, "moderator");
    await db.query("update public.rate_limit_rules set max_hits = 1000");
    need = await createDraftNeed(db, requester, { title: "Laptop for a coding course", accepted_support_types: ALL_TYPES });
    need2 = await createDraftNeed(db, requester, { title: "Course fees for a bookkeeping certificate", accepted_support_types: ALL_TYPES });
    await publish(need);
    await publish(need2);
    await db.query(
      "insert into private.app_secrets (name, value_hash) values ('jobs_server_token', $1)",
      [createHash("sha256").update("jobs-test-token").digest("hex")],
    );
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  describe("offers", () => {
    it("a supporter makes a gift offer: version 1, conversation, history, audit and a queued notification", async () => {
      const { offer_id } = await offer(sup1, need, "gift", 5000, { message: "Happy to help with this." });
      const o = await one("select * from public.offers where id = $1", [offer_id]);
      expect([o.status, o.current_version, o.last_proposed_by, o.currency]).toEqual(["proposed", 1, sup1, "GBP"]);
      expect((await one("select count(*)::int n from public.offer_versions where offer_id = $1", [offer_id])).n).toBe(1);
      expect(await convFor(offer_id)).toBeTruthy();
      expect((await one("select event from public.deal_events where offer_id = $1", [offer_id])).event).toBe("offer_proposed");
      expect((await one("select count(*)::int n from public.audit_events where action = 'offer.created' and entity_id = $1", [offer_id])).n).toBe(1);
      expect((await one("select type from private.notification_outbox where user_id = $1 order by id desc", [requester])).type).toBe("offer_received");
    });

    it("rejects offers from the requester, from non-supporters, on unpublished needs and of unaccepted types", async () => {
      await expectPgError(offer(requester, need, "gift", 100, {}), /Only supporters|own need/);
      const draft = await createDraftNeed(db, requester, { title: "Unpublished draft need here", accepted_support_types: ["gift"] });
      await expectPgError(offer(sup2, draft, "gift", 100, {}), "not open for offers");
      const giftOnly = await createDraftNeed(db, requester, { title: "Gift only need for tests", accepted_support_types: ["gift"] });
      await publish(giftOnly);
      await expectPgError(offer(sup2, giftOnly, "milestone", 100, { milestones: [] }), "does not accept that type");
    });

    it("one open offer per supporter per need; amounts must be sensible", async () => {
      await expectPgError(offer(sup1, need, "gift", 100, {}), "already have an open offer");
      await expectPgError(offer(sup2, need, "gift", 0, {}), "Enter an amount");
      await expectPgError(offer(sup2, need, "gift", 10_000_000, {}), "up to twice");
    });

    it("paid tasks need the requester's opt-in and remote, complete terms", async () => {
      await expectPgError(offer(sup2, need, "paid_task", 8000, TASK()), "not accepting paid tasks");
      await db.query("insert into public.support_preferences (user_id, open_to_paid_tasks) values ($1, true)", [requester]);
      await expectPgError(offer(sup2, need, "paid_task", 8000, TASK({ remote_only: false })), "must be remote");
      await expectPgError(offer(sup2, need, "paid_task", 8000, TASK({ deliverables: [] })), "between 1 and 10 deliverables");
      await expectPgError(offer(sup2, need, "paid_task", 8000, TASK({ max_revisions: 9 })), "0 to 5");
      await expectPgError(offer(sup2, need, "paid_task", 8000, TASK({ deadline: "2001-01-01" })), "between tomorrow");
      const { offer_id } = await offer(sup2, need, "paid_task", 8000, { ...TASK(), surprise: "dropped" });
      const v = await one("select terms from public.offer_versions where offer_id = $1", [offer_id]);
      expect(v.terms.surprise).toBeUndefined();
      expect(v.terms.remote_only).toBe(true);
    });

    it("bank and card details are refused; contact details are allowed with a warning and a reviewer signal", async () => {
      await expectPgError(offer(sup3, need, "gift", 1000, { message: "Send it to sort code 12-34-56" }), "do not share bank");
      const r = await offer(sup3, need, "gift", 1000, { message: "WhatsApp me on 07700 900123" });
      expect(r.warnings).toEqual(expect.arrayContaining(["off_platform_contact", "phone_number"]));
      expect((await one("select count(*)::int n from public.risk_signals where entity_type = 'offer' and entity_id = $1", [r.offer_id])).n).toBe(1);
      await rpc(sup3, "select public.withdraw_offer($1)", [r.offer_id]);
    });

    it("negotiation alternates turns, versions are immutable, and stale terms cannot be accepted", async () => {
      const id = (await one("select id from public.offers where supporter_id = $1 and offer_type = 'paid_task'", [sup2])).id;
      await expectPgError(rpc(sup2, "select public.counter_offer($1, 1, 9000, $2)", [id, JSON.stringify(TASK())]), "Wait for the other member");
      await expectPgError(rpc(sup2, "select public.accept_offer($1, 1)", [id]), "other member must accept");
      await rpc(requester, "select public.counter_offer($1, 1, 9500, $2)", [id, JSON.stringify(TASK({ max_revisions: 1 }))]);
      await expectPgError(rpc(sup2, "select public.accept_offer($1, 1)", [id]), "terms have changed");
      await expectPgError(db.query("update public.offer_versions set amount_minor = 1 where offer_id = $1", [id]), "append-only");
      const o = await one("select status, current_version, amount_minor from public.offers where id = $1", [id]);
      expect([o.status, o.current_version, Number(o.amount_minor)]).toEqual(["countered", 2, 9500]);
    });

    it("acceptance creates an immutable agreement whose hash matches its terms, and it is not funded", async () => {
      const id = (await one("select id from public.offers where supporter_id = $1 and offer_type = 'paid_task'", [sup2])).id;
      const agreementId = (await rpc(sup2, "select public.accept_offer($1, 2) as a", [id])).rows[0].a as string;
      const a = await one("select * from public.agreements where id = $1", [agreementId]);
      expect(a.status).toBe("awaiting_payment_readiness");
      expect(Number(a.amount_minor)).toBe(9500);
      expect(a.max_revisions).toBe(1);
      const hash = (await one("select encode(sha256(convert_to(terms_snapshot::text, 'UTF8')), 'hex') h from public.agreements where id = $1", [agreementId])).h;
      expect(a.terms_sha256).toBe(hash);
      expect(a.terms_snapshot.version).toBe(2);
      const funding = await rpc(requester, "select public.agreement_funding_status($1) s", [agreementId], false);
      expect(funding.rows[0].s).toBe("not_funded");
      await expectPgError(db.query("update public.agreements set terms_snapshot = '{}' where id = $1", [agreementId]), "immutable");
      await expectPgError(db.query("update public.agreements set amount_minor = 1 where id = $1", [agreementId]), "immutable");
      await expectPgError(db.query("update public.offers set amount_minor = 1 where id = $1", [id]), "immutable");
      const events = (await db.query("select event from public.deal_events where offer_id = $1 order by id", [id])).rows.map((r) => r.event);
      expect(events).toEqual(["offer_proposed", "offer_countered", "offer_accepted", "agreement_created"]);
    });

    it("clients cannot write offers, versions, agreements, events, messages or files directly", async () => {
      for (const sql of [
        "insert into public.offers (need_id, requester_id, supporter_id, offer_type, amount_minor, currency) values ($1, $2, $3, 'gift', 1, 'GBP')",
        "insert into public.agreements (offer_id, offer_version_id, agreement_type, requester_id, supporter_id, amount_minor, currency, terms_snapshot, terms_sha256) values ($1, $1, 'gift', $2, $3, 1, 'GBP', '{}', repeat('a', 64))",
        "insert into public.deal_events (offer_id, event) values ($1, 'x')",
        "insert into public.messages (conversation_id, sender_id, body) values ($1, $2, 'hi')",
        "update public.agreements set status = 'completed' where requester_id = $2 and $1::uuid is not null and $3::uuid is not null",
      ]) {
        const n = Math.max(...[...sql.matchAll(/\$(\d)/g)].map((m) => Number(m[1])));
        await expectPgError(as(db, user(sup1), (q) => q(sql, [need, requester, sup1].slice(0, n))), "permission denied");
      }
      await expectPgError(as(db, user(sup1), (q) => q("select * from private.notification_outbox")), "permission denied");
      await expectPgError(as(db, user(sup1), (q) => q("select private.run_scheduled_work()")), "permission denied");
    });

    it("the requester declines; the supporter withdraws; neither can act on a closed offer", async () => {
      const gift = (await one("select id from public.offers where supporter_id = $1 and need_id = $2 and status = 'proposed'", [sup1, need])).id;
      await expectPgError(rpc(sup1, "select public.decline_offer($1, 'x')", [gift]), "Only the requester");
      await rpc(requester, "select public.decline_offer($1, 'Thanks, already covered')", [gift]);
      await expectPgError(rpc(sup1, "select public.withdraw_offer($1)", [gift]), "no longer open");
      await expectPgError(rpc(requester, "select public.accept_offer($1, 1)", [gift]), "no longer open");
    });
  });

  describe("paid-task workflow", () => {
    let agreement: string;
    beforeAll(async () => {
      agreement = (await one("select id from public.agreements where supporter_id = $1", [sup2])).id;
    });

    it("work cannot start until payment is ready, unless the test-environment flag is on", async () => {
      await expectPgError(rpc(requester, "select public.start_task_work($1)", [agreement]), "payment is not ready");
      await db.query("update public.platform_settings set value = 'true' where key = 'sandbox_workflows'");
      await expectPgError(rpc(sup2, "select public.start_task_work($1)", [agreement]), "Only the person doing the task");
      await rpc(requester, "select public.start_task_work($1)", [agreement]);
      const a = await one("select status, test_mode from public.agreements where id = $1", [agreement]);
      expect([a.status, a.test_mode]).toEqual(["active", true]);
      await expectPgError(db.query("update public.agreements set test_mode = false where id = $1", [agreement]), "cannot be relabelled");
    });

    it("submission, a revision within the limit, resubmission, then acceptance", async () => {
      await expectPgError(rpc(sup2, "select public.submit_task_work($1, $2, null)", [agreement, "Here is the work for you to see."]), "Only the person");
      await rpc(requester, "select public.submit_task_work($1, $2, null)", [agreement, "Three concepts attached as agreed in the brief."]);
      await expectPgError(rpc(sup2, "select public.review_task_work($1, 'revision', 'no')", [agreement]), "10+ characters");
      await rpc(sup2, "select public.review_task_work($1, 'revision', $2)", [agreement, "Please make the wordmark larger, per criteria."]);
      await expectPgError(rpc(sup2, "select public.review_task_work($1, 'accept', null)", [agreement]), "no submitted work");
      await rpc(requester, "select public.submit_task_work($1, $2, null)", [agreement, "Revised logo with a larger wordmark as requested."]);
      await expectPgError(rpc(sup2, "select public.review_task_work($1, 'revision', $2)", [agreement, "One more change to the colours please."]), "All agreed revisions");
      await rpc(sup2, "select public.review_task_work($1, 'accept', 'Great work')", [agreement]);
      const a = await one("select a.status, a.revisions_used, o.status offer_status from public.agreements a join public.offers o on o.id = a.offer_id where a.id = $1", [agreement]);
      expect([a.status, a.revisions_used, a.offer_status]).toEqual(["completed", 1, "completed"]);
      const events = (await db.query("select event from public.deal_events where agreement_id = $1 order by id", [agreement])).rows.map((r) => r.event);
      expect(events).toEqual(["offer_accepted", "agreement_created", "work_started", "work_submitted", "revision_requested", "work_submitted", "work_accepted"]);
    });

    it("silence after submission accepts the work automatically when the review window passes", async () => {
      const { offer_id } = await offer(sup3, need2, "paid_task", 6000, TASK({ max_revisions: 0 }));
      const ag = (await rpc(requester, "select public.accept_offer($1, 1) a", [offer_id])).rows[0].a;
      await rpc(requester, "select public.start_task_work($1)", [ag]);
      await rpc(requester, "select public.submit_task_work($1, $2, null)", [ag, "Work delivered exactly as described in the brief."]);
      await db.query("update public.agreements set submitted_at = now() - interval '8 days' where id = $1", [ag]);
      await expectPgError(as(db, { role: "anon" }, (q) => q("select public.run_jobs('wrong')")), "Invalid server token");
      const out = (await as(db, { role: "anon" }, (q) => q("select public.run_jobs('jobs-test-token') r"), true)).rows[0].r;
      expect(out.tasks_auto_accepted).toBe(1);
      expect((await one("select status from public.agreements where id = $1", [ag])).status).toBe("completed");
    });

    it("disputes: a party opens one; only an independent moderator with MFA resolves it", async () => {
      const { offer_id } = await offer(sup1, need2, "paid_task", 7000, TASK());
      const ag = (await rpc(requester, "select public.accept_offer($1, 1) a", [offer_id])).rows[0].a;
      await rpc(requester, "select public.start_task_work($1)", [ag]);
      await expectPgError(rpc(sup1, "select public.open_dispute($1, 'too short')", [ag]), "between 20");
      const disputeId = (await rpc(sup1, "select public.open_dispute($1, $2) d", [ag, "No work has been delivered and the deadline is near."])).rows[0].d;
      expect((await one("select status from public.agreements where id = $1", [ag])).status).toBe("disputed");
      await expectPgError(rpc(requester, "select public.resolve_dispute($1, 'complete', $2)", [disputeId, "I resolve this in my own favour."]), "Moderator role");
      await expectPgError(rpc(moderator, "select public.resolve_dispute($1, 'cancel', $2)", [disputeId, "Cancelled: no deliverables were provided."], true, "aal1"), "Moderator role");
      await rpc(moderator, "select public.resolve_dispute($1, 'cancel', $2)", [disputeId, "Cancelled: no deliverables were provided."]);
      const a = await one("select a.status, o.status os, d.status ds, d.resolved_by from public.agreements a join public.offers o on o.id = a.offer_id join public.disputes d on d.agreement_id = a.id where a.id = $1", [ag]);
      expect([a.status, a.os, a.ds, a.resolved_by]).toEqual(["cancelled", "cancelled", "resolved", moderator]);
    });

    it("milestone offers must add up and create frozen milestones; direct support is non-cash", async () => {
      const ms = (amount: number) => ({ milestones: [
        { title: "Enrol", criteria: "Enrolment confirmation from the college", evidence: "Enrolment letter", amount_minor: amount, due_date: tomorrowPlus(10) },
        { title: "Complete module 1", criteria: "Module 1 certificate issued", evidence: "Certificate", amount_minor: 2000, due_date: tomorrowPlus(60) },
      ] });
      await expectPgError(offer(sup2, need2, "milestone", 5000, ms(2000)), "add up exactly");
      const { offer_id } = await offer(sup2, need2, "milestone", 5000, ms(3000));
      const ag = (await rpc(requester, "select public.accept_offer($1, 1) a", [offer_id])).rows[0].a;
      expect((await one("select count(*)::int n, sum(amount_minor)::int s from public.agreement_milestones where agreement_id = $1", [ag]))).toEqual({ n: 2, s: 5000 });
      expect((await one("select status from public.agreements where id = $1", [ag])).status).toBe("awaiting_payment_readiness");

      await expectPgError(offer(sup3, need, "direct_support", 100, { kind: "mentoring", description: "Weekly mentoring sessions on interview skills.", online_or_public_only: true }), "non-cash");
      const ds = await offer(sup3, need, "direct_support", 0, { kind: "mentoring", description: "Weekly mentoring sessions on interview skills.", online_or_public_only: true });
      const dsa = (await rpc(requester, "select public.accept_offer($1, 1) a", [ds.offer_id])).rows[0].a;
      expect((await one("select status from public.agreements where id = $1", [dsa])).status).toBe("active");
      await expectPgError(rpc(sup3, "select public.confirm_support_received($1)", [dsa]), "Only the requester");
      await rpc(requester, "select public.confirm_support_received($1)", [dsa]);
      expect((await one("select status from public.agreements where id = $1", [dsa])).status).toBe("completed");
    });
  });

  describe("messaging, blocking and moderation", () => {
    let offerId: string;
    let conv: string;
    beforeAll(async () => {
      offerId = (await offer(outsider, need2, "gift", 1500, { message: "Good luck with the course" })).offer_id;
      conv = await convFor(offerId);
    });

    it("participants message each other; bank details are refused; contact details are flagged", async () => {
      await rpc(outsider, "select public.send_message($1, 'Hello, is the course still running?', null)", [conv]);
      const warn = (await rpc(requester, "select public.send_message($1, 'Yes! Text me on 07700 900456', null) r", [conv])).rows[0].r;
      expect(warn.warnings).toContain("phone_number");
      await expectPgError(rpc(requester, "select public.send_message($1, 'My IBAN is GB29 NWBK 6016 1331 9268 19', null)", [conv]), "do not share bank");
      await expectPgError(rpc(sup1, "select public.send_message($1, 'intrude', null)", [conv]), "Conversation not found");
      const seen = await as(db, user(sup1), (q) => q("select count(*)::int n from public.messages where conversation_id = $1", [conv]));
      expect(seen.rows[0].n).toBe(0);
      await expectPgError(db.query("update public.messages set body = 'edited' where conversation_id = $1", [conv]), "append-only");
    });

    it("staff cannot read conversations directly, only within a case, and every view is logged", async () => {
      const direct = await as(db, user(moderator), (q) => q("select count(*)::int n from public.messages where conversation_id = $1", [conv]));
      expect(direct.rows[0].n).toBe(0);
      // The flagged phone number put the conversation in scope; review it, then check it falls out of scope.
      const viewed = await rpc(moderator, "select count(*)::int n from public.staff_read_conversation($1)", [conv]);
      expect(viewed.rows[0].n).toBe(2);
      expect((await one("select count(*)::int n from public.audit_events where action = 'conversation.viewed' and entity_id = $1", [conv])).n).toBe(1);
      const signals = (await db.query("select s.id from public.risk_signals s join public.messages m on m.id = s.entity_id where m.conversation_id = $1", [conv])).rows;
      for (const s of signals) await rpc(moderator, "select public.mark_risk_signal_reviewed($1)", [s.id]);
      await expectPgError(rpc(moderator, "select * from public.staff_read_conversation($1)", [conv]), "Not found");
      // A report from a participant brings it back into scope.
      const msg = (await one("select id from public.messages where conversation_id = $1 and sender_id = $2", [conv, outsider])).id;
      await expectPgError(rpc(outsider, "select public.submit_report('message', $1, 'fraud_or_scam', null)", [msg]), "your own message");
      await rpc(requester, "select public.submit_report('message', $1, 'fraud_or_scam', 'Asked me to pay elsewhere')", [msg]);
      expect((await rpc(moderator, "select count(*)::int n from public.staff_read_conversation($1)", [conv])).rows[0].n).toBe(2);
      await expectPgError(rpc(moderator, "select * from public.staff_read_conversation($1)", [conv], true, "aal1"), "Not found");
    });

    it("blocking stops new offers, counters, messages and uploads but keeps the record readable", async () => {
      await rpc(requester, "select public.block_user($1, 'Pressured me to pay outside SolveANeed')", [outsider]);
      await expectPgError(rpc(outsider, "select public.send_message($1, 'Please reply', null)", [conv]), "cannot message this member");
      await expectPgError(rpc(requester, "select public.send_message($1, 'Bye', null)", [conv]), "cannot message this member");
      await expectPgError(rpc(requester, "select public.accept_offer($1, 1)", [offerId]), "cannot interact");
      await expectPgError(offer(outsider, need, "gift", 500, {}), "cannot interact");
      const allowed = await as(db, user(outsider), (q) => q("select public.conversation_upload_allowed($1) ok", [conv]));
      expect(allowed.rows[0].ok).toBe(false);
      const kept = await as(db, user(requester), (q) => q("select count(*)::int n from public.messages where conversation_id = $1", [conv]));
      expect(kept.rows[0].n).toBe(2);
      await rpc(requester, "select public.unblock_user($1)", [outsider]);
    });

    it("notifications are delivered durably and never contain message text, file paths or amounts", async () => {
      await as(db, { role: "anon" }, (q) => q("select public.run_jobs('jobs-test-token')"), true);
      const pending = await one("select count(*)::int n from private.notification_outbox where status = 'pending'");
      expect(pending.n).toBe(0);
      const all = (await db.query("select title, coalesce(body, '') body, link_path from public.notifications where type not like 'need_%'")).rows;
      expect(all.length).toBeGreaterThan(5);
      const bodies = (await db.query("select body from public.messages")).rows.map((r) => r.body as string);
      for (const n of all) {
        const text = `${n.title} ${n.body}`;
        for (const b of bodies) expect(text).not.toContain(b);
        expect(text).not.toMatch(/07700|conversation-files|need-evidence|£|\d{3,}/);
        expect(n.link_path).toMatch(/^\/dashboard\/(offers|agreements)\/[0-9a-f-]{36}$/);
      }
      // Each member sees only their own notifications.
      const mine = await as(db, user(sup1), (q) => q("select distinct user_id from public.notifications"));
      expect(mine.rows.map((r) => r.user_id)).toEqual([sup1]);
    });

    it("expired offers close automatically", async () => {
      const { offer_id } = await offer(sup3, need2, "gift", 800, {});
      await db.query("update public.offers set expires_at = now() - interval '1 minute' where id = $1", [offer_id]);
      await expectPgError(rpc(requester, "select public.accept_offer($1, 1)", [offer_id]), "expired");
      await as(db, { role: "anon" }, (q) => q("select public.run_jobs('jobs-test-token')"), true);
      expect((await one("select status from public.offers where id = $1", [offer_id])).status).toBe("expired");
    });

    it("a failed delivery is retried with backoff, not lost", async () => {
      await db.query("insert into private.notification_outbox (user_id, type) values ($1, 'offer_received')", [requester]);
      await db.query("alter table public.notifications add constraint test_block check (type <> 'offer_received') not valid");
      await db.query("select private.process_notification_outbox(10)");
      const row = await one("select status, attempts, next_attempt_at > now() later from private.notification_outbox order by id desc limit 1");
      expect([row.status, row.attempts, row.later]).toEqual(["pending", 1, true]);
      await db.query("alter table public.notifications drop constraint test_block");
      await db.query("update private.notification_outbox set next_attempt_at = now() where status = 'pending'");
      await db.query("select private.process_notification_outbox(10)");
      expect((await one("select status from private.notification_outbox order by id desc limit 1")).status).toBe("sent");
    });
  });
});
