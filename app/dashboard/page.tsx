import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";

export default async function DashboardIndex() {
  const viewer = await requireViewer("/dashboard");
  if (viewer.roles.includes("requester")) redirect("/dashboard/requester");
  if (viewer.roles.includes("supporter")) redirect("/dashboard/supporter");
  redirect("/dashboard/settings?missingRole=requester");
}
