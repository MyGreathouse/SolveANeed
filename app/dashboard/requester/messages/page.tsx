import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Messages" };

export default function Page() {
  return (
    <Planned
      title="Messages"
      phase={3}
      description="Private conversations linked to offers and agreements will appear here."
      back={{ href: "/dashboard/requester/needs", label: "View my needs" }}
    />
  );
}
