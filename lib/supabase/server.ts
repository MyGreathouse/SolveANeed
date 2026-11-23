import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

export class SupabaseNotConfiguredError extends Error {
  constructor() {
    super("Supabase is not configured. Copy .env.example to .env.local and add your project URL and publishable key.");
  }
}

/**
 * Per-request Supabase client acting AS THE SIGNED-IN USER.
 * Every query is subject to row-level security. There is deliberately no
 * service-role client in the web app (least privilege).
 */
export async function createClient() {
  if (!isSupabaseConfigured()) throw new SupabaseNotConfiguredError();
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}
