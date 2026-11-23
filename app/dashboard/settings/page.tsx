import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";
import { DeleteAccountForm, NotificationsForm, ProfileForm } from "@/components/dashboard/SettingsForms";
import { setRoleAction, signOutEverywhereAction, signOutOtherSessionsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

const NOTICES: Record<string, string> = {
  "roles-updated": "Your roles have been updated.",
  "sessions-revoked": "You've been signed out of all other devices.",
  "password-updated": "Your password has been updated and other devices have been signed out.",
};

function Card({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="card scroll-mt-24 p-6 md:p-8">
      <h2 id={`${id}-title`} className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const sp = await searchParams;
  const viewer = await requireViewer("/dashboard/settings");
  const supabase = await createClient();
  const [{ data: p }, currencies] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, bio, region, preferred_currency, show_region, notify_email_offers, notify_email_messages, notify_email_updates, notify_marketing, created_at")
      .eq("id", viewer.id)
      .single(),
    getCurrencies(),
  ]);
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const missingRole = sp.missingRole === "requester" || sp.missingRole === "supporter" ? sp.missingRole : null;

  return (
    <>
      <PageHeader title="Settings" description={`Signed in as ${viewer.email ?? viewer.displayName}`} />
      <div className="space-y-6">
        {notice && <Alert tone="success" live>{notice}</Alert>}
        {missingRole && (
          <Alert tone="info" title={`Turn on the ${missingRole} role to continue`}>
            That area is for {missingRole}s. You can switch it on below — one account works for both.
          </Alert>
        )}

        <Card id="profile" title="Profile">
          <ProfileForm
            currencies={currencies.filter((c) => c.enabled)}
            defaults={{ displayName: p?.display_name ?? "", bio: p?.bio ?? "", region: p?.region ?? "", preferredCurrency: p?.preferred_currency ?? "GBP", showRegion: p?.show_region ?? true }}
          />
        </Card>

        <Card id="roles" title="How you use SolveANeed" description="Use one account to ask for help, offer help, or both.">
          <ul className="space-y-3">
            {(["requester", "supporter"] as const).map((role) => {
              const on = viewer.roles.includes(role);
              return (
                <li key={role} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold capitalize text-navy-900">{role} {on && <Badge tone="success">On</Badge>}</p>
                    <p className="text-sm text-muted">{role === "requester" ? "Post needs and receive offers of help." : "Discover, save and support needs."}</p>
                  </div>
                  <form action={setRoleAction}>
                    <input type="hidden" name="role" value={role} />
                    <input type="hidden" name="enabled" value={String(!on)} />
                    <SubmitButton variant={on ? "outline" : "navy"} size="sm" pendingLabel="Updating…">{on ? `Turn off ${role}` : `Turn on ${role}`}</SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
          {viewer.roles.some((r) => r === "moderator" || r === "admin" || r === "business_rep") && (
            <p className="mt-4 text-sm text-muted">Staff and business roles are managed by an administrator.</p>
          )}
        </Card>

        <Card id="notifications" title="Notification preferences" description="In-app notifications are always on. Choose which emails you receive.">
          <NotificationsForm
            defaults={{
              notifyOffers: p?.notify_email_offers ?? true,
              notifyMessages: p?.notify_email_messages ?? true,
              notifyUpdates: p?.notify_email_updates ?? true,
              notifyMarketing: p?.notify_marketing ?? false,
            }}
          />
        </Card>

        <Card id="security" title="Password and sessions">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Change password</h3>
              <div className="mt-4"><ResetPasswordForm /></div>
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold">Active sessions</h3>
              <p className="text-sm text-muted">If you&apos;ve signed in on a shared or lost device, sign out everywhere else.</p>
              <form action={signOutOtherSessionsAction}><SubmitButton variant="outline" pendingLabel="Signing out…">Sign out of other devices</SubmitButton></form>
              <form action={signOutEverywhereAction}><SubmitButton variant="ghost" pendingLabel="Signing out…">Sign out everywhere (including here)</SubmitButton></form>
            </div>
          </div>
        </Card>

        <Card id="privacy" title="Privacy and your data">
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-charcoal">
            <li>Your email address is never shown to other members.</li>
            <li>Supporting evidence is visible only to you and our moderators.</li>
            <li>You can hide your name on individual needs and hide your region above.</li>
            <li>To request a copy of your data, contact our privacy team (see the <Link className="underline" href="/legal/privacy">Privacy Notice</Link>).</li>
          </ul>
        </Card>

        <Card id="delete" title="Delete account" description="This anonymises your profile immediately, withdraws your drafts and live needs, and signs you out everywhere. Records we must keep by law (for example payment records, once payments exist) are retained for the required period and then deleted.">
          <DeleteAccountForm />
        </Card>
      </div>
    </>
  );
}
