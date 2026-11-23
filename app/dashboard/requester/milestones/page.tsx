import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Milestones" };

export default function Page() {
  return (
    <Planned
      title="Milestones"
      phase={5}
      description="Milestone sponsorships, evidence submissions and approvals will appear here."
      back={{ href: "/dashboard/requester/needs", label: "View my needs" }}
    />
  );
}
