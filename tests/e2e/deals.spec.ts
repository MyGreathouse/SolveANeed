import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { writeFileSync } from "node:fs";
import { enrolMfaViaUi, signIn, signOut, signUpAndVerify, sql, uniqueEmail } from "./support";

/**
 * Phase 3 journey through the real UI: offer → counter-offer → acceptance →
 * agreement (not funded) → paid task in the test environment → revision →
 * completion; messaging with safety screening; non-cash support; dispute
 * resolved by an independent moderator with MFA; blocking.
 */
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

test.describe.serial("offers, agreements and messaging", () => {
  const requester = { name: "Amara", email: uniqueEmail("p3req") };
  const supporter = { name: "Ben", email: uniqueEmail("p3sup") };
  const moderator = { name: "Mo", email: uniqueEmail("p3mod") };
  let needId = "";
  let need2Id = "";
  let offerId = "";
  let agreementUrl = "";
  let modSecret = "";

  test("setup: two members and two published needs", async ({ page }) => {
    await signUpAndVerify(page, { ...requester, intent: "need" });
    await signOut(page);
    await signUpAndVerify(page, { ...supporter, intent: "help" });
    await signOut(page);
    const [{ id: reqId }] = await sql<{ id: string }>("select id from auth.users where email = $1", [requester.email]);
    const insert = (title: string) =>
      sql<{ id: string }>(
        `insert into public.needs (requester_id, title, category_slug, description, amount_minor, currency, intended_use, region,
           accepted_support_types)
         values ($1, $2, 'skills-training', $3, 50000, 'GBP', 'Course fees and materials for the certificate.', 'East Midlands',
           '{gift,paid_task,milestone,direct_support}') returning id`,
        [reqId, title, "I have a place on a bookkeeping certificate course and need help covering the fees and the study materials for it."],
      );
    needId = (await insert(`Bookkeeping certificate ${Date.now() % 100000}`))[0].id;
    need2Id = (await insert(`Interview coaching ${Date.now() % 100000}`))[0].id;
    // Moderation itself is covered by marketplace.spec.ts; here the needs are published directly.
    for (const id of [needId, need2Id]) {
      await sql("update public.needs set status = 'pending_review', submitted_at = now() where id = $1", [id]);
      await sql("update public.needs set status = 'published', published_at = now() where id = $1", [id]);
    }
  });

  test("the requester opts in to paid tasks", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto("/dashboard/requester/tasks");
    await expect(page.getByRole("heading", { name: "Paid-task offers: off" })).toBeVisible();
    await page.getByRole("button", { name: "Turn on" }).click();
    await expect(page.getByText("You are now open to paid-task offers")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Paid-task offers: on" })).toBeVisible();
  });

  test("a supporter proposes a paid task; validation keeps what they typed", async ({ page }) => {
    await signIn(page, supporter.email);
    await page.goto(`/needs/${needId}`);
    await page.getByRole("link", { name: "Make an offer" }).click();
    await expect(page.getByRole("heading", { name: "Make an offer" })).toBeVisible();
    await axe(page);
    await page.getByRole("radio", { name: /Earn/ }).check();
    await page.getByLabel(/Task price/).fill("80");
    await page.getByLabel("Task title").fill("Design a logo for my bakery");
    await page.getByRole("button", { name: "Send offer" }).click();
    await expect(page.getByText(/Task description must be at least 20/)).toBeVisible();
    await expect(page.getByLabel("Task title")).toHaveValue("Design a logo for my bakery");

    await page.getByLabel("What needs doing").fill("A simple modern logo for a small home bakery, supplied as PNG and SVG.");
    await page.getByLabel("Deliverables").fill("Three initial concepts\nFinal logo as PNG and SVG");
    await page.getByLabel("Deadline").fill(future(14));
    await page.getByLabel("Revisions included").selectOption("1");
    await page.getByLabel("Acceptance criteria").fill("Delivered in both formats and matching the agreed concept.");
    await page.getByRole("checkbox", { name: /remotely/ }).check();
    await page.getByRole("button", { name: "Send offer" }).click();
    await page.waitForURL(/\/dashboard\/offers\/[0-9a-f-]{36}\?notice=created/);
    offerId = page.url().split("/").pop()!.split("?")[0];
    await expect(page.getByText("Your offer has been sent")).toBeVisible();
    await expect(page.getByText("Awaiting response")).toBeVisible();
    const [o] = await sql<{ status: string; current_version: number; amount_minor: string }>(
      "select status, current_version, amount_minor from public.offers where id = $1", [offerId]);
    expect(o).toEqual({ status: "proposed", current_version: 1, amount_minor: "8000" });
  });

  test("the requester counters with new terms (version 2)", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto("/dashboard/requester/offers");
    await expect(page.getByText("Your response needed")).toBeVisible();
    await page.getByRole("link", { name: /Bookkeeping certificate/ }).click();
    await expect(page.getByRole("heading", { name: "Offer from Ben" })).toBeVisible();
    await axe(page);
    await page.getByText("Propose different terms").click();
    await page.getByLabel(/Task price/).fill("95");
    await page.getByRole("button", { name: "Send counter-offer" }).click();
    await expect(page.getByText("Your new terms have been sent.")).toBeVisible();
    await expect(page.getByText("Waiting for Ben to respond to version 2")).toBeVisible();
    await expect(page.getByText("Amara proposed new terms (version 2)")).toBeVisible();
  });

  test("messages are screened: contact details warn, bank details are refused", async ({ page }) => {
    await signIn(page, supporter.email);
    await page.goto(`/dashboard/offers/${offerId}`);
    await page.getByLabel("Your message").fill("Happy with £95. Could you text me on 07700 900123?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/Sent, but it contains .*a phone number/)).toBeVisible();
    await expect(page.getByRole("list", { name: "Messages" }).getByText("Happy with £95.", { exact: false })).toBeVisible();
    await page.getByLabel("Your message").fill("Or pay me to sort code 12-34-56 directly");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/do not share bank, card or identity details/)).toBeVisible();
    const n = await sql<{ n: number }>("select count(*)::int n from public.messages m join public.conversations c on c.id = m.conversation_id where c.offer_id = $1", [offerId]);
    expect(n[0].n).toBe(1);
  });

  test("the supporter accepts version 2: an immutable agreement that is not funded", async ({ page }) => {
    await signIn(page, supporter.email);
    await page.goto(`/dashboard/offers/${offerId}`);
    await page.getByRole("button", { name: "Accept version 2" }).click();
    await page.waitForURL(/\/dashboard\/agreements\/[0-9a-f-]{36}\?notice=agreed/);
    agreementUrl = page.url().split("?")[0];
    await expect(page.getByText("Agreed — not funded").first()).toBeVisible();
    await expect(page.getByText("Not funded — no money has moved")).toBeVisible();
    await expect(page.getByText(/Terms fingerprint \(SHA-256\): [0-9a-f]{64}/)).toBeVisible();
    await expect(page.getByText(/Waiting for payment readiness/)).toBeVisible();
    await axe(page);
    await page.setViewportSize({ width: 412, height: 915 });
    await axe(page);
  });

  test("paid task in the test environment: start, submit, revise, resubmit, accept", async ({ page }) => {
    const pdf = "/tmp/solveaneed-e2e-deliverable.pdf";
    writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

    await signIn(page, requester.email);
    await page.goto(agreementUrl);
    await page.getByRole("button", { name: "Start work" }).click();
    await expect(page.getByText("Test environment — no money moves.")).toBeVisible();
    await page.getByLabel("What are you submitting?").fill("Three logo concepts, attached as one PDF.");
    await page.getByLabel(/Attach the work/).setInputFiles(pdf);
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Work submitted.")).toBeVisible();
    await signOut(page);

    await signIn(page, supporter.email);
    await page.goto(agreementUrl);
    await page.getByLabel(/^Note/).fill("Please make the wordmark larger, per the criteria.");
    await page.getByRole("button", { name: "Request a revision" }).click();
    await expect(page.getByText("Revision requested.").first()).toBeVisible();
    await signOut(page);

    await signIn(page, requester.email);
    await page.goto(agreementUrl);
    await expect(page.getByText("Please make the wordmark larger").first()).toBeVisible();
    await page.getByLabel("What are you submitting?").fill("Revised logo with a larger wordmark, as requested.");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect(page.getByText("Work submitted.")).toBeVisible();
    await signOut(page);

    await signIn(page, supporter.email);
    await page.goto(agreementUrl);
    await expect(page.getByText("0 revisions left")).toBeVisible();
    await expect(page.getByRole("button", { name: "Request a revision" })).toHaveCount(0);
    await page.getByRole("button", { name: "Accept the work" }).click();
    await expect(page.getByText("Work accepted. This task is complete.")).toBeVisible();
    for (const line of ["Ben accepted version 2", "Amara started work (test environment — no payment)", "Ben requested revision 1 of 1", "Ben accepted the work"]) {
      await expect(page.getByText(line).first()).toBeVisible();
    }
    // The attachment opens for a party through a short-lived signed URL.
    const href = await page.getByRole("link", { name: "solveaneed-e2e-deliverable.pdf" }).first().getAttribute("href");
    expect((await page.request.get(href!, { maxRedirects: 0 })).status()).toBe(302);
  });

  test("notifications arrived and contain no message text", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto("/dashboard/notifications");
    await expect(page.getByText("New offer on your need")).toBeVisible();
    await expect(page.getByText("Task completed")).toBeVisible();
    await expect(page.getByText("07700")).toHaveCount(0);
  });

  test("an outsider cannot open the offer, agreement or attachment", async ({ page }) => {
    const outsider = uniqueEmail("p3out");
    await signUpAndVerify(page, { name: "Eve", email: outsider, intent: "both" });
    expect((await page.goto(`/dashboard/offers/${offerId}`))!.status()).toBe(404);
    expect((await page.goto(agreementUrl))!.status()).toBe(404);
    const [f] = await sql<{ id: string }>("select f.id from public.conversation_files f join public.conversations c on c.id = f.conversation_id where c.offer_id = $1", [offerId]);
    expect((await page.request.get(`/api/files/${f.id}`, { maxRedirects: 0 })).status()).toBe(404);
  });

  test("non-cash support goes to a dispute that an independent moderator resolves", async ({ page }) => {
    await signIn(page, supporter.email);
    await page.goto(`/needs/${need2Id}/offer`);
    await page.getByRole("radio", { name: /Solve/ }).check();
    await page.getByLabel("Kind of help").selectOption("mentoring");
    await page.getByLabel("What you will do").fill("Two one-hour video calls practising interview questions.");
    await page.getByRole("checkbox", { name: /online or in a public place/ }).check();
    await page.getByRole("button", { name: "Send offer" }).click();
    await page.waitForURL(/notice=created/);
    const dsOffer = page.url().split("/").pop()!.split("?")[0];
    await signOut(page);

    await signIn(page, requester.email);
    await page.goto(`/dashboard/offers/${dsOffer}`);
    await page.getByRole("button", { name: "Accept version 1" }).click();
    await page.waitForURL(/\/dashboard\/agreements\//);
    await page.getByText("Something has gone wrong — open a dispute").click();
    await page.getByLabel(/What went wrong/).fill("The supporter has not attended either of the two agreed calls.");
    await page.getByRole("button", { name: "Open dispute" }).click();
    await expect(page.getByText("Dispute opened.")).toBeVisible();
    await signOut(page);

    await signUpAndVerify(page, { ...moderator, intent: "help" });
    const [{ id: modId }] = await sql<{ id: string }>("select id from auth.users where email = $1", [moderator.email]);
    await sql("insert into public.user_roles (user_id, role) values ($1, 'moderator')", [modId]);
    modSecret = await enrolMfaViaUi(page);
    await signOut(page);
    await signIn(page, moderator.email, undefined, modSecret);
    await page.goto("/admin/disputes");
    await page.getByRole("link", { name: "Review case" }).first().click();
    await expect(page.getByText("The supporter has not attended")).toBeVisible();
    await page.getByRole("link", { name: "Open conversation (logged)" }).click();
    await expect(page.getByText("No messages.")).toBeVisible();
    const logged = await sql<{ n: number }>("select count(*)::int n from public.audit_events where action = 'conversation.viewed' and actor_id = $1", [modId]);
    expect(logged[0].n).toBeGreaterThan(0);
    await page.getByRole("radio", { name: /Cancel the agreement/ }).check();
    await page.getByLabel(/Decision and reasons/).fill("Cancelled: the agreed sessions did not take place.");
    await page.getByRole("button", { name: "Resolve dispute" }).click();
    await expect(page.getByText("Dispute resolved. Both parties have been notified.")).toBeVisible();
    await axe(page);
  });

  test("blocking stops new messages but keeps the conversation", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto(`/dashboard/offers/${offerId}`);
    await page.getByText("Block Ben").click();
    await page.getByLabel("Reason (private to you)").fill("Asked for my phone number");
    await page.getByRole("button", { name: "Block member" }).click();
    await expect(page.getByText("Member blocked.")).toBeVisible();
    await expect(page.getByText("Happy with £95.")).toBeVisible();
    await signOut(page);

    await signIn(page, supporter.email);
    await page.goto(`/dashboard/offers/${offerId}`);
    await page.getByLabel("Your message").fill("Hello?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText(/You cannot message this member/)).toBeVisible();
    await page.goto(`/needs/${needId}/offer`);
    // The completed offer is not "open", so a new one can be attempted — and is refused.
    await page.getByRole("radio", { name: /Give/ }).check();
    await page.getByLabel(/^Amount/).fill("10");
    await page.getByRole("button", { name: "Send offer" }).click();
    await expect(page.getByText("You cannot interact with this member")).toBeVisible();
  });
});
