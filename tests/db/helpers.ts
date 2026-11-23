import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

/**
 * Database policy test harness.
 * Requires a disposable Postgres 15+/16 database in TEST_DATABASE_URL.
 * The database is DROPPED and rebuilt from supabase/migrations on every run.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const root = path.resolve(import.meta.dirname, "../..");

export async function rebuildDatabase(): Promise<void> {
  const url = new URL(TEST_DATABASE_URL!);
  const dbName = url.pathname.slice(1);
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = "/postgres";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`drop database if exists "${dbName}" with (force)`);
  await admin.query(`create database "${dbName}"`);
  await admin.end();

  const db = new Client({ connectionString: TEST_DATABASE_URL });
  await db.connect();
  await db.query(readFileSync(path.join(root, "tests/db/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(path.join(dir, file), "utf8"));
  }
  await db.end();
}

export async function connect(): Promise<Client> {
  const c = new Client({ connectionString: TEST_DATABASE_URL });
  await c.connect();
  return c;
}

export type Meta = { display_name?: string; age_confirmed?: string; terms_accepted?: string; intent?: string };

/** Creates an auth user as the superuser (fires the profile trigger). */
export async function createUser(db: Client, meta: Meta = {}): Promise<string> {
  const full = { display_name: "Test User", age_confirmed: "true", terms_accepted: "true", intent: "both", ...meta };
  const { rows } = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [`u${Math.random().toString(36).slice(2)}@example.test`, full],
  );
  return rows[0].id as string;
}

export async function grantRole(db: Client, userId: string, role: string): Promise<void> {
  await db.query("insert into public.user_roles (user_id, role) values ($1, $2) on conflict do nothing", [userId, role]);
}

/**
 * Runs `fn` inside a transaction as the given Supabase role/user, then rolls
 * back unless `commit` is true. Mirrors how PostgREST executes requests.
 */
export async function as<T>(
  db: Client,
  who: { role: "anon" | "authenticated"; userId?: string },
  fn: (q: Client["query"]) => Promise<T>,
  commit = false,
): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${who.role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(who.userId ? { sub: who.userId, role: who.role } : { role: who.role }),
    ]);
    const result = await fn(db.query.bind(db) as Client["query"]);
    await db.query(commit ? "commit" : "rollback");
    return result;
  } catch (e) {
    await db.query("rollback");
    throw e;
  }
}

export const user = (userId: string) => ({ role: "authenticated" as const, userId });
export const anon = { role: "anon" as const };

/** Inserts a complete draft need as its owner and returns its id. */
export async function createDraftNeed(
  db: Client,
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const values = {
    title: "Laptop for a web development course",
    category_slug: "skills-training",
    description:
      "I have been accepted onto a twelve-week web development bootcamp and need a reliable laptop to complete the coursework and projects.",
    amount_minor: 65000,
    currency: "GBP",
    intended_use: "Purchase of a mid-range laptop suitable for software development.",
    region: "East Midlands",
    ...overrides,
  };
  return as(db, user(ownerId), async (q) => {
    const cols = Object.keys(values);
    const { rows } = await q(
      `insert into public.needs (requester_id, ${cols.join(", ")}) values ($1, ${cols
        .map((_, i) => `$${i + 2}`)
        .join(", ")}) returning id`,
      [ownerId, ...Object.values(values)],
    );
    return rows[0].id as string;
  }, true);
}

export async function expectPgError(p: Promise<unknown>, match?: RegExp | string): Promise<string> {
  try {
    await p;
  } catch (e) {
    const msg = (e as Error).message;
    if (match && !(typeof match === "string" ? msg.includes(match) : match.test(msg))) {
      throw new Error(`Expected error matching ${match}, got: ${msg}`);
    }
    return msg;
  }
  throw new Error(`Expected a database error${match ? ` matching ${match}` : ""}, but the query succeeded`);
}
