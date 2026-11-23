"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies } from "@/lib/data/needs";
import { CATEGORY_SLUGS, SUPPORT_TYPE_VALUES, UK_REGIONS } from "@/lib/domain/catalog";
import { MoneyError, parseMajorToMinor } from "@/lib/money";
import { str, type FormState } from "@/lib/utils/form";

const prefsSchema = z.object({
  categories: z.array(z.enum(CATEGORY_SLUGS)),
  supportTypes: z.array(z.enum(SUPPORT_TYPE_VALUES)),
  regions: z.array(z.enum(UK_REGIONS)),
  currency: z.union([z.literal(""), z.string().regex(/^[A-Z]{3}$/)]),
  maxAmount: z.string().trim(),
  openToPaidTasks: z.boolean(),
});

export async function savePreferencesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = prefsSchema.safeParse({
    categories: fd.getAll("categories").map(String),
    supportTypes: fd.getAll("supportTypes").map(String),
    regions: fd.getAll("regions").map(String),
    currency: str(fd, "currency"),
    maxAmount: str(fd, "maxAmount"),
    openToPaidTasks: str(fd, "openToPaidTasks") === "on",
  });
  if (!parsed.success) return { errors: { form: "Some selections were not recognised. Please try again." } };

  let maxAmountMinor: number | null = null;
  if (parsed.data.maxAmount) {
    if (!parsed.data.currency) return { errors: { maxAmount: "Choose a currency for your budget." } };
    const info = (await getCurrencies()).find((c) => c.code === parsed.data.currency);
    if (!info) return { errors: { currency: "Choose a supported currency." } };
    try {
      maxAmountMinor = parseMajorToMinor(parsed.data.maxAmount, info.minorUnit);
    } catch (e) {
      return { errors: { maxAmount: e instanceof MoneyError ? e.message : "Enter a valid amount." } };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("support_preferences").upsert({
    user_id: viewer.id,
    categories: parsed.data.categories,
    support_types: parsed.data.supportTypes,
    regions: parsed.data.regions,
    currency: parsed.data.currency || null,
    max_amount_minor: maxAmountMinor,
    open_to_paid_tasks: parsed.data.openToPaidTasks,
  });
  if (error) return { errors: { form: "We couldn't save your preferences. Please try again." } };
  revalidatePath("/dashboard/supporter");
  redirect("/dashboard/supporter?notice=preferences-saved");
}
