import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth/session";
import { getCurrencies } from "@/lib/data/needs";
import { getPreferences } from "@/lib/data/preferences";
import { PageHeader } from "@/components/ui/PageHeader";
import { PreferencesForm } from "@/components/dashboard/PreferencesForm";
import { getCurrency, minorToMajorString } from "@/lib/money";

export const metadata: Metadata = { title: "Matching Preferences" };

export default async function PreferencesPage() {
  const viewer = await requireViewer("/dashboard/supporter/preferences");
  const [prefs, currencies] = await Promise.all([getPreferences(viewer.id), getCurrencies()]);
  const maxAmount =
    prefs?.max_amount_minor != null && prefs.currency ? minorToMajorString(prefs.max_amount_minor, getCurrency(prefs.currency, currencies).minorUnit) : "";
  return (
    <>
      <PageHeader
        title="Matching preferences"
        description="We use simple, explainable rules to show needs that match what you care about. Descriptions are never scored, so emotive wording can't jump the queue."
      />
      <PreferencesForm
        currencies={currencies.filter((c) => c.enabled)}
        defaults={{
          categories: prefs?.categories ?? [],
          supportTypes: prefs?.support_types ?? [],
          regions: prefs?.regions ?? [],
          currency: prefs?.currency ?? "",
          maxAmount,
          openToPaidTasks: prefs?.open_to_paid_tasks ?? false,
        }}
      />
    </>
  );
}
