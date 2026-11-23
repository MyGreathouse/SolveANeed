import { notFound, redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/domain/validation";

export default async function CaseByMessage({ params }: PageProps<"/admin/cases/by-message/[messageId]">) {
  await requireStaff();
  const { messageId } = await params;
  if (!uuidSchema.safeParse(messageId).success) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("staff_offer_for_message", { p_message_id: messageId });
  if (typeof data !== "string") notFound();
  redirect(`/admin/cases/${data}`);
}
