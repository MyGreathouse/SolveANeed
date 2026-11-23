"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { MODERATION_ACTIONS, MODERATION_ACTIONS_REQUIRING_NOTE, type ModerationAction } from "@/lib/domain/need-status";
import { uuidSchema } from "@/lib/domain/validation";
import { str, type FormState } from "@/lib/utils/form";

async function staffOrThrow(adminOnly = false) {
  const s = await requireStaff({ adminOnly });
  if (s.mfaRequired && !s.mfaSatisfied) throw new Error("Multi-factor authentication required");
  return s;
}

export async function moderateNeedAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await staffOrThrow();
  const needId = str(fd, "needId");
  const action = str(fd, "action") as ModerationAction;
  const note = str(fd, "note").trim().slice(0, 2000);
  if (!uuidSchema.safeParse(needId).success || !MODERATION_ACTIONS.includes(action)) return { errors: { form: "Invalid request." } };
  if (MODERATION_ACTIONS_REQUIRING_NOTE.includes(action) && !note) {
    return { errors: { note: "Explain the decision so the requester knows what to do next." } };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("moderate_need", { p_need_id: needId, p_action: action, p_note: note || null });
  if (error) return { errors: { form: error.code === "22023" || error.code === "42501" ? error.message : "The action failed. Please refresh and try again." } };
  revalidatePath("/admin", "layout");
  redirect(`/admin/needs/${needId}?done=${action}`);
}

export async function resolveReportAction(fd: FormData): Promise<void> {
  await staffOrThrow();
  const id = uuidSchema.parse(str(fd, "reportId"));
  const status = str(fd, "status");
  if (!["under_review", "actioned", "dismissed"].includes(status)) return;
  const supabase = await createClient();
  await supabase.rpc("resolve_report", { p_report_id: id, p_status: status, p_resolution: str(fd, "resolution").slice(0, 1000) || null });
  revalidatePath("/admin/reports");
}

export async function reviewSignalAction(fd: FormData): Promise<void> {
  await staffOrThrow();
  const id = uuidSchema.parse(str(fd, "signalId"));
  const supabase = await createClient();
  await supabase.rpc("mark_risk_signal_reviewed", { p_signal_id: id });
  revalidatePath("/admin", "layout");
}

export async function setAccountStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  await staffOrThrow();
  const userId = str(fd, "userId");
  const status = str(fd, "status");
  const reason = str(fd, "reason").trim();
  if (!uuidSchema.safeParse(userId).success || !["active", "suspended"].includes(status)) return { errors: { form: "Invalid request." } };
  if (!reason) return { errors: { reason: "A reason is required and will be recorded in the audit log." } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_account_status", { p_user_id: userId, p_status: status, p_reason: reason });
  if (error) return { errors: { form: error.message } };
  revalidatePath("/admin/users");
  return { ok: true, message: `Account ${status === "suspended" ? "suspended" : "reinstated"}.` };
}

export async function setStaffRoleAction(fd: FormData): Promise<void> {
  await staffOrThrow(true);
  const userId = uuidSchema.parse(str(fd, "userId"));
  const role = str(fd, "role");
  if (!["moderator", "admin", "business_rep"].includes(role)) return;
  const supabase = await createClient();
  await supabase.rpc("admin_set_role", { p_user_id: userId, p_role: role, p_enabled: str(fd, "enabled") === "true" });
  revalidatePath("/admin/users");
}
