import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { markAllReadAction } from "../settings/actions";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/dashboard/notifications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, link_path, read_at, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = data ?? [];
  const unread = items.some((n) => !n.read_at);
  return (
    <>
      <PageHeader
        title="Notifications"
        actions={unread ? <form action={markAllReadAction}><SubmitButton variant="outline" size="sm" pendingLabel="Updating…">Mark all as read</SubmitButton></form> : undefined}
      />
      {items.length ? (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className={cn("card p-5", !n.read_at && "border-l-4 border-l-gold-500")}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-navy-900">{!n.read_at && <span className="sr-only">Unread: </span>}{n.title}</p>
                  {n.body && <p className="mt-1 text-sm text-muted">{n.body}</p>}
                  {n.link_path && <Link href={n.link_path} className="mt-2 inline-block text-sm font-semibold text-navy-900 underline">View</Link>}
                </div>
                <time dateTime={n.created_at} className="shrink-0 text-xs text-muted">{new Date(n.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</time>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="You're all caught up" description="Updates about your needs, offers and account will appear here." />
      )}
    </>
  );
}
