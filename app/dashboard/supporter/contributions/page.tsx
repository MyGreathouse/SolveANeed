import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "My Contributions" };

export default function Page() {
  return (
    <Planned
      title="My Contributions"
      phase={4}
      description="Your contributions will appear here once regulated payments are live."
      back={{ href: "/dashboard/supporter", label: "Discover needs" }}
    />
  );
}
