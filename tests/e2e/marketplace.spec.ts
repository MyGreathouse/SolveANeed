import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { PASSWORD, enrolMfaViaUi, latestEmailLink, signIn, signOut, signUpAndVerify, sql, uniqueEmail } from "./support";

/**
 * Full journey: sign-up with email verification → create need → private
 * evidence → submit → moderator approval → public listing → supporter
 * save/report → authorisation checks → password reset → account deletion.
 */
test.describe.serial("marketplace journey", () => {
  const requester = { name: "Amara", email: uniqueEmail("req") };
  const moderator = { name: "Mo Moderator", email: uniqueEmail("mod") };
  const title = `Laptop for a web development bootcamp ${Date.now() % 100000}`;
  let needUrl = "";
  let needId = "";
  let modSecret = "";

  test("sign-up enforces 18+ confirmation and password strength", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Display name").fill("Young Person");
    await page.getByLabel("Email address").fill(uniqueEmail("minor"));
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("short");
    await page.getByLabel(/I agree to the/).check();
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("You must be 18 or over to join SolveANeed")).toBeVisible();
    await expect(page.getByText("Use at least 12 characters")).toBeVisible();
    await expect(page).toHaveURL(/\/sign-up/);
  });

  test("requester signs up, verifies email and lands on Create a Need", async ({ page }) => {
    await signUpAndVerify(page, { ...requester, intent: "need" });
    await expect(page).toHaveURL(/\/dashboard\/requester\/needs\/new/);
    await expect(page.getByRole("heading", { name: "Tell supporters what you need" })).toBeVisible();
  });

  test("requester saves a draft, uploads nothing yet, then submits for review", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto("/dashboard/requester/needs/new");

    // Submitting an incomplete need shows field errors and keeps input.
    await page.getByLabel("Title").fill("Too short");
    await page.getByLabel("Category").selectOption("skills-training");
    await page.getByRole("button", { name: "Save and submit for review" }).click();
    await expect(page.getByText("A few details are needed before you can submit")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveValue("Too short");

    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Detailed description").fill(
      "I have been accepted onto a twelve-week web development bootcamp starting in the spring and I need a reliable laptop to complete the coursework and portfolio projects.",
    );
    await page.getByLabel("Currency").selectOption("GBP");
    await page.getByLabel("Requested amount").fill("650.00");
    await page.getByLabel("How will the support be used?").fill("Purchase of a mid-range laptop suitable for software development work.");
    await page.getByLabel("General location").selectOption("East Midlands");
    await page.getByRole("checkbox", { name: /Earn/ }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByText("Your changes have been saved.")).toBeVisible();
    needUrl = page.url().split("?")[0];
    needId = needUrl.split("/").pop()!;

    const [row] = await sql<{ amount_minor: string; currency: string; status: string }>(
      "select amount_minor, currency, status from public.needs where id = $1", [needId]);
    expect(row).toEqual({ amount_minor: "65000", currency: "GBP", status: "draft" });

    // Private evidence: upload through the app (real Supabase Storage), open it, then a second file is removed.
    const pdf = "/tmp/solveaneed-e2e-evidence.pdf";
    writeFileSync(pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
    const fake = "/tmp/solveaneed-e2e-fake.pdf";
    writeFileSync(fake, "this is not really a pdf");
    await page.getByLabel("Add a file").setInputFiles(fake);
    await page.getByRole("button", { name: "Upload privately" }).click();
    await expect(page.getByText(/contents don't match its type/)).toBeVisible();
    await page.getByLabel("Add a file").setInputFiles(pdf);
    await page.getByRole("button", { name: "Upload privately" }).click();
    await expect(page.getByText("uploaded privately")).toBeVisible();
    const link = page.getByRole("link", { name: /solveaneed-e2e-evidence\.pdf/ });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    const opened = await page.request.get(href!, { maxRedirects: 0 });
    expect(opened.status()).toBe(302);
    expect(opened.headers()["cache-control"]).toBe("no-store");
    const file = await page.request.get(opened.headers()["location"]);
    expect((await file.body()).subarray(0, 4).toString()).toBe("%PDF");

    await page.getByRole("button", { name: "Save and submit for review" }).click();
    await expect(page.getByText("Submitted for review")).toBeVisible();
    await expect(page.getByText("Under review")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveCount(0); // locked while in review
  });

  test("signed-out visitors and other members cannot open the evidence link", async ({ page }) => {
    const [ev] = await sql<{ id: string }>("select id from public.need_evidence where need_id = $1", [needId]);
    const anon = await page.request.get(`/api/evidence/${ev.id}`, { maxRedirects: 0 });
    expect(anon.status()).toBe(401);
  });

  test("an unpublished need is invisible to the public", async ({ page }) => {
    const res = await page.goto(`/needs/${needId}`);
    expect(res?.status()).toBe(404);
  });

  test("non-staff cannot reach the admin console, and cannot open another user's need", async ({ page }) => {
    const other = uniqueEmail("other");
    await signUpAndVerify(page, { name: "Olu", email: other, intent: "both" });
    const admin = await page.goto("/admin");
    expect(admin?.status()).toBe(404);
    const foreign = await page.goto(`/dashboard/requester/needs/${needId}`);
    expect(foreign?.status()).toBe(404);
    const [ev] = await sql<{ id: string }>("select id from public.need_evidence where need_id = $1", [needId]);
    const evidence = await page.request.get(`/api/evidence/${ev.id}`, { maxRedirects: 0 });
    expect(evidence.status()).toBe(404);
    await signOut(page);
  });

  test("a new moderator is sent to set up MFA before reaching the admin console", async ({ page }) => {
    await signUpAndVerify(page, { ...moderator, intent: "help" });
    await sql("insert into public.user_roles (user_id, role) select id, 'moderator' from auth.users where email = $1", [moderator.email]);
    await page.goto("/admin/needs");
    await expect(page).toHaveURL(/\/dashboard\/settings\?mfa=required/);
    await expect(page.getByText("Two-step verification is required for staff")).toBeVisible();
    modSecret = await enrolMfaViaUi(page);
    await page.goto("/admin");
    await expect(page.getByText("MFA verified")).toBeVisible();
    await signOut(page);

    // Next sign-in: password alone is not enough.
    await page.goto("/sign-in");
    await page.getByLabel("Email address").fill(moderator.email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/mfa/);
    await page.getByRole("textbox", { name: "6-digit code" }).fill("000000");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page.getByText(/code didn't match/)).toBeVisible();
    const res = await page.goto("/admin");
    expect(page.url()).toMatch(/\/mfa/);
    expect(res?.status()).toBeLessThan(500);
    await signOut(page);
  });

  test("moderator approves the need; requester is notified", async ({ page }) => {
    await signIn(page, moderator.email, PASSWORD, modSecret);
    await page.goto("/admin/needs");
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Evidence is in scope during review; opening it is audit-logged.
    const evLink = page.getByRole("link", { name: /solveaneed-e2e-evidence\.pdf/ });
    await expect(evLink).toBeVisible();
    const opened = await page.request.get((await evLink.getAttribute("href"))!, { maxRedirects: 0 });
    expect(opened.status()).toBe(302);

    // A note is required to request changes.
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByText("Explain the decision")).toBeVisible();

    await page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(page.getByText(/Action recorded: approve/)).toBeVisible();

    const [n] = await sql<{ status: string }>("select status from public.needs where id = $1", [needId]);
    expect(n.status).toBe("published");
    const audit = await sql("select action from public.audit_events where entity_id = $1 order by id", [needId]);
    expect(audit.map((a) => a.action)).toEqual(["need.submitted", "evidence.viewed", "need.moderated"]);
    // After publication, with no open report, evidence is out of scope for moderators.
    await page.reload();
    await expect(page.getByText(/Evidence is only available to moderators while/)).toBeVisible();
    await signOut(page);
  });

  test("the published need appears publicly with correct money formatting", async ({ page }) => {
    await page.goto("/needs");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.goto(`/needs/${needId}`);
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("£650", { exact: true })).toBeVisible();
    await expect(page.getByText("Posted by Amara")).toBeVisible();
    await page.goto("/needs?currency=GBP&min=600&max=700");
    await expect(page.getByRole("link", { name: title })).toBeVisible();
    await page.goto("/needs?currency=GBP&min=700");
    await expect(page.getByRole("link", { name: title })).toHaveCount(0);
  });

  test("supporter saves and reports the need", async ({ page }) => {
    await signIn(page, moderator.email, PASSWORD, modSecret);
    await page.goto(`/needs/${needId}`);
    await page.getByRole("button", { name: "Save this need" }).click();
    await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
    await page.goto("/dashboard/supporter/saved");
    await expect(page.getByRole("link", { name: title })).toBeVisible();

    await page.goto(`/needs/${needId}`);
    await page.getByText("Report a concern").click();
    await page.getByLabel("Reason").selectOption("misleading");
    await page.getByLabel(/Details/).fill(`Testing the report flow ${title}`);
    await page.getByRole("button", { name: "Send report" }).click();
    await expect(page.getByText("Your report has been sent")).toBeVisible();
    await page.goto("/admin/reports");
    await expect(page.getByText(`Testing the report flow ${title}`)).toBeVisible();
    await signOut(page);
  });

  test("requester sees the approval notification", async ({ page }) => {
    await signIn(page, requester.email);
    await page.goto("/dashboard/notifications");
    await expect(page.getByText("Your need is live")).toBeVisible();
    await page.getByRole("button", { name: "Mark all as read" }).click();
    await expect(page.getByRole("button", { name: "Mark all as read" })).toHaveCount(0);
  });

  test("repeated failed sign-ins are rate limited", async ({ page }) => {
    const victim = uniqueEmail("ratelimit");
    let limited = false;
    for (let i = 0; i < 10 && !limited; i++) {
      await page.goto("/sign-in");
      await page.getByLabel("Email address").fill(victim);
      await page.getByLabel("Password").fill("wrong-password-123");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /incorrect|Too many/ })).toBeVisible();
      limited = (await page.getByText("Too many attempts").count()) > 0;
    }
    expect(limited).toBe(true);
  });

  test("password reset by email works and the new password signs in", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email address").fill(requester.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByText(/If an account exists/)).toBeVisible();
    await new Promise((r) => setTimeout(r, 1500));
    const link = await latestEmailLink(requester.email);
    expect(link).toContain("type=recovery");
    await page.goto(link);
    await expect(page).toHaveURL(/\/reset-password/);
    await page.getByRole("textbox", { name: "New password", exact: true }).fill(`${PASSWORD}-new`);
    await page.getByRole("textbox", { name: "Confirm new password" }).fill(`${PASSWORD}-new`);
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText(/password has been updated/)).toBeVisible();
    await signOut(page);
    await signIn(page, requester.email, `${PASSWORD}-new`);
  });

  test("account deletion anonymises the profile and closes the need", async ({ page }) => {
    await signIn(page, requester.email, `${PASSWORD}-new`);
    await page.goto("/dashboard/settings#delete");
    await page.getByLabel(/to confirm/).fill("DELETE");
    await page.getByRole("button", { name: "Delete my account" }).click();
    await expect(page.getByRole("heading", { name: "Your account deletion request has been received" })).toBeVisible();
    const [p] = await sql<{ display_name: string; account_status: string }>(
      "select display_name, account_status from public.profiles p join auth.users u on u.id = p.id where u.email = $1", [requester.email]);
    expect(p).toEqual({ display_name: "Deleted member", account_status: "deletion_requested" });
    const res = await page.goto(`/needs/${needId}`);
    expect(res?.status()).toBe(404);
  });
});
