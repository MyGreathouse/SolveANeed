import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/account", "/api", "/auth"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
