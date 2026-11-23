import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Offers Received" };

export default function Page() {
  return (
    <Planned
      title="Offers Received"
      phase={3}
      description="Offers of gifts, paid tasks, milestone funding and direct support will appear here, with a negotiation thread for each."
      back={{ href: "/dashboard/requester/needs", label: "View my needs" }}
    />
  );
}
