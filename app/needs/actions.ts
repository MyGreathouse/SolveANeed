"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { reportSchema, uuidSchema } from "@/lib/domain/validation";
import { str, zodErrors, type FormState } from "@/lib/utils/form";

export async function toggleSaveNeedAction(fd: FormData): Promise<void> {
  const needId = uuidSchema.parse(str(fd, "needId"));
  const viewer = await requireViewer(`/needs/${needId}`);
  const supabase = await createClient();
  if (str(fd, "saved") === "true") {
    await supabase.from("saved_needs").delete().eq("user_id", viewer.id).eq("need_id", needId);
  } else {
    await supabase.from("saved_needs").insert({ user_id: viewer.id, need_id: needId });
  }
  revalidatePath(`/needs/${needId}`);
  revalidatePath("/dashboard/supporter/saved");
}

export async function reportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = reportSchema.safeParse({
    targetType: str(fd, "targetType"),
    targetId: str(fd, "targetId"),
    reason: str(fd, "reason"),
    details: str(fd, "details"),
  });
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  await requireViewer();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_report", {
    p_target_type: parsed.data.targetType,
    p_target_id: parsed.data.targetId,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
  });
  if (error) {
    return { errors: { form: error.code === "54000" ? error.message : "We couldn't send your report. Please try again." } };
  }
  return { ok: true, message: "Thank you. Your report has been sent to our moderation team." };
}
