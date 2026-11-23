import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface StoredPreferences {
  categories: string[];
  support_types: string[];
  regions: string[];
  currency: string | null;
  max_amount_minor: number | null;
  open_to_paid_tasks: boolean;
}

export async function getPreferences(userId: string): Promise<StoredPreferences | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("support_preferences")
    .select("categories, support_types, regions, currency, max_amount_minor, open_to_paid_tasks")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as StoredPreferences | null) ?? null;
}
