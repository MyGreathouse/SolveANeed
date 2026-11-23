import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Runs due background work (notification delivery, offer expiry, task
 * auto-acceptance) through the token-gated run_jobs() RPC. Called after
 * member actions so notifications arrive promptly, and by the scheduled
 * /api/jobs/run route as a backstop. Failures are retried by the outbox.
 */
export function jobsToken(): string | null {
  return process.env.JOBS_SERVER_TOKEN || process.env.RATE_LIMIT_SERVER_TOKEN || null;
}

export async function runJobs(): Promise<Record<string, number> | null> {
  const token = jobsToken();
  if (!token) return null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("run_jobs", { p_server_token: token });
    if (error) return null;
    return data as Record<string, number>;
  } catch {
    return null;
  }
}
