import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/domain/validation";

/**
 * Opens a conversation attachment through a 60-second signed URL.
 * Parties always; staff only inside an open case, via an audit-logged,
 * short-lived grant (authorise_conversation_file + storage RLS).
 */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  if (!uuidSchema.safeParse(id).success) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Unauthorised", { status: 401 });

  const { data: path, error } = await supabase.rpc("authorise_conversation_file", { p_file_id: id });
  if (error || typeof path !== "string") return new NextResponse("Not found", { status: 404 });

  const { data: signed, error: signErr } = await supabase.storage.from("conversation-files").createSignedUrl(path, 60);
  if (signErr || !signed) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.redirect(signed.signedUrl, 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
