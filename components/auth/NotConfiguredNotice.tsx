import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Alert } from "@/components/ui/Alert";

export function NotConfiguredNotice() {
  if (isSupabaseConfigured()) return null;
  return (
    <Alert tone="warning" className="mt-5" title="Preview mode">
      The database is not connected yet, so accounts can&apos;t be created. Add your Supabase keys to <code>.env.local</code> (see SETUP guide).
    </Alert>
  );
}
