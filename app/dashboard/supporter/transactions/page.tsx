import type { Metadata } from "next";
import { Planned } from "@/components/dashboard/Planned";

export const metadata: Metadata = { title: "Transaction History" };

export default function Page() {
  return (
    <Planned
      title="Transaction History"
      phase={4}
      description="A full history of your payments, refunds and receipts will appear here once payments are live."
      back={{ href: "/dashboard/supporter", label: "Discover needs" }}
    />
  );
}
