"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getCurrencies } from "@/lib/data/needs";
import { checkReadyToSubmit, needDraftSchema, toNeedRow, uuidSchema } from "@/lib/domain/validation";
import { checkEvidenceFile, safeFileName } from "@/lib/security/file-validation";
import { str, zodErrors, type FormState } from "@/lib/utils/form";

const DB_MESSAGES: Record<string, string> = {
  "42501": "You don't have permission to do that.",
  "54000": "You've reached today's limit. Please try again later.",
  "23505": "You already have an active need with this title.",
  P0002: "That need could not be found.",
};

function friendlyDbError(error: { code?: string; message?: string }): string {
  // Validation messages raised by submit_need() (SQLSTATE 22023) are written for users.
  if (error.code === "22023" || error.code === "54000" || error.code === "23505") return error.message ?? "Please check your details.";
  return DB_MESSAGES[error.code ?? ""] ?? "Something went wrong saving your need. Please try again.";
}

/** Create or update a draft; optionally submit it for moderation. */
export async function saveNeedAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireRole(["requester"], { next: "/dashboard/requester/needs/new" });
  const needId = str(fd, "needId");
  const intent = str(fd, "intent") === "submit" ? "submit" : "save";

  const raw = {
    title: str(fd, "title"),
    categorySlug: str(fd, "categorySlug"),
    description: str(fd, "description"),
    amount: str(fd, "amount"),
    currency: str(fd, "currency"),
    intendedUse: str(fd, "intendedUse"),
    region: str(fd, "region"),
    acceptedSupportTypes: fd.getAll("acceptedSupportTypes").map(String),
    deadline: str(fd, "deadline"),
    visibility: str(fd, "visibility") || "public",
    showRequesterName: str(fd, "showRequesterName") === "on",
  };
  const values: Record<string, string> = {
    ...Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === "string")),
    acceptedSupportTypes: raw.acceptedSupportTypes.join(","),
    showRequesterName: raw.showRequesterName ? "on" : "",
  } as Record<string, string>;

  const parsed = needDraftSchema.safeParse(raw);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values };

  const currencies = await getCurrencies();
  const { row, errors } = toNeedRow(parsed.data, currencies);
  if (Object.keys(errors).length) return { errors, values };

  if (intent === "submit") {
    const today = new Date().toISOString().slice(0, 10);
    const readiness = checkReadyToSubmit(row, today, currencies);
    if (Object.keys(readiness).length) {
      return { errors: { ...readiness, form: "A few details are needed before you can submit. Your changes have not been saved yet." }, values };
    }
  }

  const supabase = await createClient();
  let id = needId;
  if (id) {
    if (!uuidSchema.safeParse(id).success) return { errors: { form: "Invalid need." }, values };
    const { error, count } = await supabase.from("needs").update(row, { count: "exact" }).eq("id", id).eq("requester_id", viewer.id);
    if (error) return { errors: { form: friendlyDbError(error) }, values };
    if (!count) return { errors: { form: "This need can no longer be edited (it may already be under review)." }, values };
  } else {
    const { data, error } = await supabase.from("needs").insert({ ...row, requester_id: viewer.id }).select("id").single();
    if (error || !data) return { errors: { form: friendlyDbError(error ?? {}) }, values };
    id = data.id;
  }

  if (intent === "submit") {
    const { error } = await supabase.rpc("submit_need", { p_need_id: id });
    revalidatePath("/dashboard/requester/needs");
    if (error) {
      // Draft is saved even if submission fails; take the user to it with the reason.
      redirect(`/dashboard/requester/needs/${id}?notice=saved&submitError=${encodeURIComponent(friendlyDbError(error))}`);
    }
    redirect(`/dashboard/requester/needs/${id}?notice=submitted`);
  }
  revalidatePath("/dashboard/requester/needs");
  redirect(`/dashboard/requester/needs/${id}?notice=saved`);
}

export async function submitNeedAction(fd: FormData): Promise<void> {
  await requireRole(["requester"]);
  const id = uuidSchema.parse(str(fd, "needId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_need", { p_need_id: id });
  revalidatePath("/dashboard/requester/needs");
  redirect(`/dashboard/requester/needs/${id}?${error ? `submitError=${encodeURIComponent(friendlyDbError(error))}` : "notice=submitted"}`);
}

export async function closeNeedAction(fd: FormData): Promise<void> {
  await requireRole(["requester"]);
  const id = uuidSchema.parse(str(fd, "needId"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("close_need", { p_need_id: id });
  revalidatePath("/dashboard/requester/needs");
  redirect(`/dashboard/requester/needs/${id}?${error ? `submitError=${encodeURIComponent(friendlyDbError(error))}` : "notice=closed"}`);
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  const viewer = await requireRole(["requester"]);
  const id = uuidSchema.parse(str(fd, "needId"));
  const supabase = await createClient();
  // Remove private files first (storage RLS only allows this while the need is editable).
  const { data: files } = await supabase.from("need_evidence").select("storage_path").eq("need_id", id);
  if (files?.length) await supabase.storage.from("need-evidence").remove(files.map((f) => f.storage_path));
  await supabase.from("needs").delete().eq("id", id).eq("requester_id", viewer.id).eq("status", "draft");
  revalidatePath("/dashboard/requester/needs");
  redirect("/dashboard/requester/needs?notice=deleted");
}

export async function uploadEvidenceAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const viewer = await requireRole(["requester"]);
  const needId = str(fd, "needId");
  if (!uuidSchema.safeParse(needId).success) return { errors: { form: "Invalid need." } };
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { errors: { file: "Choose a file to upload." } };

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const check = checkEvidenceFile(file.type, file.size, head);
  if (!check.ok) return { errors: { file: check.error } };

  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("check_rate_limit", { p_action: "upload_evidence", p_max: 30, p_window_seconds: 3600 });
  if (allowed === false) return { errors: { file: "Too many uploads. Please try again later." } };

  const path = `${viewer.id}/${needId}/${randomUUID()}.${check.ext}`;
  const { error: upErr } = await supabase.storage.from("need-evidence").upload(path, file, {
    contentType: check.mime,
    upsert: false,
    cacheControl: "private, max-age=0",
  });
  if (upErr) return { errors: { file: "Upload failed. The need may no longer be editable." } };

  const { error: rowErr } = await supabase.from("need_evidence").insert({
    need_id: needId,
    owner_id: viewer.id,
    storage_path: path,
    file_name: safeFileName(file.name),
    mime_type: check.mime,
    size_bytes: file.size,
  });
  if (rowErr) {
    await supabase.storage.from("need-evidence").remove([path]);
    return { errors: { file: rowErr.code === "42501" ? "You can upload up to 10 files while a need is editable." : "We couldn't save that file. Please try again." } };
  }
  revalidatePath(`/dashboard/requester/needs/${needId}`);
  return { ok: true, message: `${safeFileName(file.name)} uploaded privately.` };
}

export async function deleteEvidenceAction(fd: FormData): Promise<void> {
  const viewer = await requireRole(["requester"]);
  const id = uuidSchema.parse(str(fd, "evidenceId"));
  const needId = uuidSchema.parse(str(fd, "needId"));
  const supabase = await createClient();
  const { data } = await supabase.from("need_evidence").select("storage_path").eq("id", id).eq("owner_id", viewer.id).maybeSingle();
  if (data) {
    const { error } = await supabase.from("need_evidence").delete().eq("id", id);
    if (!error) await supabase.storage.from("need-evidence").remove([data.storage_path]);
  }
  revalidatePath(`/dashboard/requester/needs/${needId}`);
}
