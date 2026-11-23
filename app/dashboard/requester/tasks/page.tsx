import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { listMyAgreements } from "@/lib/data/deals";
import { getCurrencies } from "@/lib/data/needs";
import { PageHeader } from "@/components/ui/PageHeader";
import { AgreementsList } from "@/components/deals/AgreementsList";
import { Alert } from "@/components/ui/Alert";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { setPaidTaskOptInAction } from "@/app/dashboard/deals/actions";

export const metadata: Metadata = { title: "Tasks" };

const NOTICES: Record<string, string> = {
  "opted-in": "You are now open to paid-task offers on needs that accept them.",
  "opted-out": "You will no longer receive new paid-task offers.",
  error: "We couldn't save that. Please try again.",
};

export default async function TasksPage({ searchParams }: PageProps<"/dashboard/requester/tasks">) {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/tasks" });
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: prefs } = await supabase.from("support_preferences").select("open_to_paid_tasks").eq("user_id", viewer.id).maybeSingle();
  const optedIn = prefs?.open_to_paid_tasks === true;
  const notice = typeof sp.notice === "string" ? NOTICES[sp.notice] : undefined;
  const [items, currencies] = await Promise.all([listMyAgreements(viewer.id), getCurrencies()]);
  const tasks = items.filter((a) => a.agreement_type === "paid_task" && a.requester_id === viewer.id);
  return (
    <>
      <PageHeader title="Tasks" description="Paid tasks you have agreed to do. Don't start work until the agreement says it is ready." />
      {notice && <Alert tone={sp.notice === "error" ? "danger" : "success"} live className="mb-4">{notice}</Alert>}
      <section className="card mb-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="optin-h">
        <div>
          <h2 id="optin-h" className="font-bold text-navy-900">Paid-task offers: {optedIn ? "on" : "off"}</h2>
          <p className="mt-1 text-sm text-muted">Paid tasks are remote, task-by-task work you agree to. You choose each one and can stop at any time.</p>
        </div>
        <form action={setPaidTaskOptInAction}>
          <input type="hidden" name="open" value={optedIn ? "false" : "true"} />
          <SubmitButton variant={optedIn ? "outline" : "teal"} size="sm" pendingLabel="Saving…">{optedIn ? "Turn off" : "Turn on"}</SubmitButton>
        </form>
      </section>
      <AgreementsList items={tasks} currencies={currencies} viewerId={viewer.id}
        emptyText="Agreed paid tasks will appear here." />
    </>
  );
}
