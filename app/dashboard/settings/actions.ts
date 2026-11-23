"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "@/lib/domain/validation";
import { str, zodErrors, type FormState } from "@/lib/utils/form";

export async function updateProfileAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const parsed = profileSchema.safeParse({
    displayName: str(fd, "displayName"),
    bio: str(fd, "bio"),
    region: str(fd, "region"),
    preferredCurrency: str(fd, "preferredCurrency"),
  });
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      bio: parsed.data.bio || null,
      region: parsed.data.region || null,
      preferred_currency: parsed.data.preferredCurrency,
      show_region: str(fd, "showRegion") === "on",
    })
    .eq("id", viewer.id);
  if (error) return { errors: { form: "We couldn't save your profile. Please try again." } };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function updateNotificationsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      notify_email_offers: str(fd, "notifyOffers") === "on",
      notify_email_messages: str(fd, "notifyMessages") === "on",
      notify_email_updates: str(fd, "notifyUpdates") === "on",
      notify_marketing: str(fd, "notifyMarketing") === "on",
    })
    .eq("id", viewer.id);
  if (error) return { errors: { form: "We couldn't save your notification settings." } };
  return { ok: true, message: "Notification preferences saved." };
}

export async function setRoleAction(fd: FormData): Promise<void> {
  await requireViewer();
  const role = str(fd, "role");
  if (role !== "requester" && role !== "supporter") return;
  const supabase = await createClient();
  await supabase.rpc("set_my_role", { p_role: role, p_enabled: str(fd, "enabled") === "true" });
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?notice=roles-updated");
}

export async function signOutOtherSessionsAction(): Promise<void> {
  await requireViewer();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard/settings?notice=sessions-revoked");
}

export async function signOutEverywhereAction(): Promise<void> {
  await requireViewer();
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "global" });
  redirect("/sign-in");
}

export async function requestDeletionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireViewer();
  if (str(fd, "deleteConfirm").trim() !== "DELETE") {
    return { errors: { deleteConfirm: "Type DELETE in capital letters to confirm." } };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_account_deletion");
  if (error) return { errors: { form: "We couldn't process your request. Please contact support." } };
  await supabase.auth.signOut({ scope: "global" });
  redirect("/account/status?deleted=1");
}

export async function markAllReadAction(): Promise<void> {
  await requireViewer();
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/dashboard", "layout");
}
