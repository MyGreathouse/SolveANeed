import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Distributed rate limiting for signed-out actions (sign-in, sign-up, password
 * reset, MFA verification). Counters live in Postgres, so limits hold across
 * every serverless instance. Only this server can consume buckets: it proves
 * itself with RATE_LIMIT_SERVER_TOKEN (the database stores only its sha256).
 *
 * Subjects (IP addresses, emails, user ids) are hashed with the token as a
 * pepper before leaving the server — raw values are never stored.
 *
 * Fail-open policy: if the token is missing or the database is unreachable the
 * action is ALLOWED and a warning is logged, so a configuration mistake cannot
 * lock every member out. Supabase Auth's own limits still apply.
 */
export type AnonAction =
  | "sign_in_ip"
  | "sign_in_email"
  | "sign_up_ip"
  | "password_reset_email"
  | "password_reset_ip"
  | "mfa_verify_user";

let warned = false;
function warnOnce(msg: string) {
  if (!warned) {
    console.warn(`[rate-limit] ${msg}`);
    warned = true;
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export function subjectHash(kind: string, value: string, pepper = process.env.RATE_LIMIT_SERVER_TOKEN ?? ""): string {
  return createHash("sha256").update(`${pepper}:${kind}:${value.trim().toLowerCase()}`).digest("hex");
}

/** Returns false when the caller is over the limit for any of the given checks. */
export async function allowAnon(checks: { action: AnonAction; subject: string }[]): Promise<boolean> {
  const token = process.env.RATE_LIMIT_SERVER_TOKEN;
  if (!token) {
    warnOnce("RATE_LIMIT_SERVER_TOKEN is not set: sign-in/sign-up/reset limits are not enforced.");
    return true;
  }
  const supabase = await createClient();
  for (const { action, subject } of checks) {
    const { data, error } = await supabase.rpc("consume_anon_rate_limit", {
      p_action: action,
      p_subject_hash: subjectHash(action, subject, token),
      p_server_token: token,
    });
    if (error) {
      warnOnce(`limiter unavailable (${error.code ?? "unknown"}); failing open.`);
      continue;
    }
    if (data === null) warnOnce("server token hash is not configured in the database; failing open.");
    if (data === false) return false;
  }
  return true;
}
