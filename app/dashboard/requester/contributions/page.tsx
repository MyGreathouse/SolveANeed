import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Contributions" };

export default function Page() {
  return (
    <Planned
      title="Contributions"
      phase={4}
      description="Contributions received towards your needs will appear here once regulated payments are live."
      back={{ href: "/dashboard/requester/needs", label: "View my needs" }}
    />
  );
}
