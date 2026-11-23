import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Sponsored Milestones" };

export default function Page() {
  return (
    <Planned
      title="Sponsored Milestones"
      phase={5}
      description="Milestones you sponsor, and evidence submitted against them, will appear here."
      back={{ href: "/dashboard/supporter", label: "Discover needs" }}
    />
  );
}
