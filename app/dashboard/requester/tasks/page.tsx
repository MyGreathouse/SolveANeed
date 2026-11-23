import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return (
    <Planned
      title="Tasks"
      phase={3}
      description="Accepted paid-task agreements, deliverables and review status will appear here."
      back={{ href: "/dashboard/requester/needs", label: "View my needs" }}
    />
  );
}
