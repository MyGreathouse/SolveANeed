import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import type { Page } from "@playwright/test";

export const PASSWORD = "Correct-Horse-42-battery";
export const uniqueEmail = (tag: string) => `e2e-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;

/**
 * Fetches the most recent email link sent to `to`.
 * Supports a directory of .eml files (E2E_MAIL_DIR) or a Mailpit API (MAILPIT_URL, used by `supabase start`).
 */
export async function latestEmailLink(to: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let body: string | null = null;
    if (process.env.E2E_MAIL_DIR) {
      const dir = process.env.E2E_MAIL_DIR;
      const files = readdirSync(dir).filter((f) => f.endsWith(`${to.replace("@", "_at_")}.eml`)).sort();
      if (files.length) body = readFileSync(path.join(dir, files[files.length - 1]), "utf8");
    } else if (process.env.MAILPIT_URL) {
      const res = await fetch(`${process.env.MAILPIT_URL}/api/v1/search?query=to:${encodeURIComponent(to)}`);
      const list = (await res.json()) as { messages?: { ID: string }[] };
      if (list.messages?.length) {
        const msg = await fetch(`${process.env.MAILPIT_URL}/api/v1/message/${list.messages[0].ID}`);
        body = ((await msg.json()) as { HTML: string }).HTML;
      }
    } else {
      throw new Error("Set E2E_MAIL_DIR or MAILPIT_URL so tests can read verification emails");
    }
    if (body) {
      const decoded = body.replace(/=\r?\n/g, "").replace(/=3D/g, "=").replace(/&amp;/g, "&");
      const m = decoded.match(/href="([^"]*\/auth\/confirm\?[^"]+)"/);
      if (m) return m[1];
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`No email received for ${to}`);
}

export async function sql<T = Record<string, unknown>>(query: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("E2E_DATABASE_URL is required for staff-role tests");
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query(query, params)).rows as T[];
  } finally {
    await c.end();
  }
}

export async function signUpAndVerify(page: Page, opts: { name: string; email: string; intent: "need" | "help" | "both" }) {
  await page.goto(`/sign-up?intent=${opts.intent}`);
  await page.getByLabel("Display name").fill(opts.name);
  await page.getByLabel("Email address").fill(opts.email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(PASSWORD);
  await page.getByLabel(/18 years of age or older/).check();
  await page.getByLabel(/I agree to the/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/check-email/);
  const link = await latestEmailLink(opts.email);
  await page.goto(link);
}

export async function signIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}
