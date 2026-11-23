import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/needs", "/how-it-works", "/give", "/earn", "/businesses", "/get-started", "/legal/terms", "/legal/privacy"].map(
    (p) => ({ url: `${SITE_URL}${p}`, changeFrequency: "weekly", priority: p === "" ? 1 : 0.7 }),
  );
}
