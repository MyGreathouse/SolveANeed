import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/domain/validation";

/**
 * Opens a private evidence file through a 60-second signed URL.
 * Authorisation is enforced in Postgres (authorise_evidence_access) and
 * again by storage RLS when the URL is signed. Staff access is audit-logged.
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/evidence/[id]">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Unauthorised", { status: 401 });

  const { data: path, error } = await supabase.rpc("authorise_evidence_access", { p_evidence_id: id });
  if (error || typeof path !== "string") return new NextResponse("Not found", { status: 404 });

  const { data: signed, error: signErr } = await supabase.storage.from("need-evidence").createSignedUrl(path, 60);
  if (signErr || !signed) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
