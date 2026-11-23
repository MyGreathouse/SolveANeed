import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Session refresh + fast redirect for signed-out visitors (see proxy-session.ts).
 * Kept as `middleware.ts` (Edge runtime) rather than Next 16's `proxy.ts`
 * (Node runtime): the Cloudflare adapter supports Edge middleware fully,
 * while Node middleware on Workers is experimental and failed on requests with
 * cookies (see docs/STAGING.md). Behaviour is identical on Node and Workers.
 */
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|brand/|images/|og-image.jpg|robots.txt|sitemap.xml|manifest.webmanifest).*)",
  ],
};
