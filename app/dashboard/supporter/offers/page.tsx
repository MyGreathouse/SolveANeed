import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Offers Made" };

export default function Page() {
  return (
    <Planned
      title="Offers Made"
      phase={3}
      description="Offers you make — and their negotiation history — will appear here."
      back={{ href: "/dashboard/supporter", label: "Discover needs" }}
    />
  );
}
