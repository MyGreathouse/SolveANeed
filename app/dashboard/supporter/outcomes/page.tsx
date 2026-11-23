import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Supported Outcomes" };

export default function Page() {
  return (
    <Planned
      title="Supported Outcomes"
      phase={4}
      description="Outcomes confirmed for needs you supported will appear here."
      back={{ href: "/dashboard/supporter", label: "Discover needs" }}
    />
  );
}
