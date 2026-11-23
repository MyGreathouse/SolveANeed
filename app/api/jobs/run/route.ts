import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runJobs } from "@/lib/server/jobs";

/**
 * Scheduled backstop for background work (Cloudflare Cron Trigger: see
 * wrangler.jsonc and custom-worker.ts).
 * Requires `Authorization: Bearer $CRON_SECRET`. Returns counts only.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok = !!secret && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new NextResponse("Not found", { status: 404 });
  const result = await runJobs();
  return NextResponse.json({ ok: result !== null, ...(result ?? {}) }, { headers: { "Cache-Control": "no-store" } });
}
