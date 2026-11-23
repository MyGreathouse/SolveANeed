// OpenNext configuration for Cloudflare Workers.
// SolveANeed renders signed-in pages dynamically; prerendered marketing pages are
// served from the static assets cache (read-only, no R2 bucket needed).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
