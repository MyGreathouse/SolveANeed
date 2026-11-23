import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth/redirects";
import { SITE_URL } from "@/lib/supabase/env";

/** Email templates pass {{ .RedirectTo }} (an absolute URL on our own site). Reduce it to a safe path. */
function resolveNext(raw: string | null, origin: string): string {
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      if (u.origin === origin || u.origin === new URL(SITE_URL).origin) return safeNextPath(u.pathname + u.search);
    } catch {
      /* ignore */
    }
    return "/dashboard";
  }
  return safeNextPath(raw);
}

/** Handles email links (sign-up verification, password recovery, email change). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = resolveNext(searchParams.get("next"), origin);

  try {
    const supabase = await createClient();
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(new URL(type === "recovery" ? "/reset-password" : next, origin));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, origin));
    }
  } catch {
    /* fall through */
  }
  return NextResponse.redirect(new URL("/sign-in?error=link-invalid", origin));
}
