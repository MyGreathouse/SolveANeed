import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { getCurrencies } from "@/lib/data/needs";
import { currencyOptions } from "@/lib/data/currency-options";
import { PageHeader } from "@/components/ui/PageHeader";
import { NeedForm } from "@/components/needs/NeedForm";

export const metadata: Metadata = { title: "Create a Need" };

export default async function NewNeedPage() {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/needs/new" });
  const currencies = await getCurrencies();
  const opts = currencyOptions(currencies);
  const preferred = opts.some((c) => c.code === viewer.preferredCurrency) ? viewer.preferredCurrency : "GBP";
  return (
    <>
      <PageHeader
        eyebrow="Create a need"
        title="Tell supporters what you need"
        description="Save a draft at any time. When you submit, a moderator reviews your need before it is published. You can add private supporting evidence after saving."
      />
      <NeedForm
        currencies={opts}
        defaults={{
          title: "", categorySlug: "", description: "", amount: "", currency: preferred, intendedUse: "", region: "",
          acceptedSupportTypes: ["gift"], deadline: "", visibility: "public", showRequesterName: true,
        }}
      />
    </>
  );
}
