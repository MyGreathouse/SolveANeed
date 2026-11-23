import type { AppRole } from "@/lib/auth/types";

export interface NavItem {
  href: string;
  label: string;
  planned?: boolean;
}

export const REQUESTER_NAV: NavItem[] = [
  { href: "/dashboard/requester", label: "Overview" },
  { href: "/dashboard/requester/needs", label: "My Needs" },
  { href: "/dashboard/requester/needs/new", label: "Create a Need" },
  { href: "/dashboard/requester/offers", label: "Offers Received" },
  { href: "/dashboard/requester/tasks", label: "Tasks" },
  { href: "/dashboard/requester/milestones", label: "Milestones", planned: true },
  { href: "/dashboard/requester/contributions", label: "Contributions", planned: true },
  { href: "/dashboard/requester/documents", label: "Documents" },
];

export const SUPPORTER_NAV: NavItem[] = [
  { href: "/dashboard/supporter", label: "Discover Needs" },
  { href: "/dashboard/supporter/saved", label: "Saved Needs" },
  { href: "/dashboard/supporter/preferences", label: "Matching Preferences" },
  { href: "/dashboard/supporter/contributions", label: "My Contributions", planned: true },
  { href: "/dashboard/supporter/offers", label: "Offers Made" },
  { href: "/dashboard/supporter/milestones", label: "Sponsored Milestones", planned: true },
  { href: "/dashboard/supporter/outcomes", label: "Supported Outcomes", planned: true },
  { href: "/dashboard/supporter/transactions", label: "Transaction History", planned: true },
];

export const DEALS_NAV: NavItem[] = [
  { href: "/dashboard/agreements", label: "Agreements" },
  { href: "/dashboard/messages", label: "Messages" },
];

export const ACCOUNT_NAV: NavItem[] = [
  { href: "/dashboard/notifications", label: "Notifications" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function sectionsFor(roles: AppRole[]) {
  return {
    requester: roles.includes("requester"),
    supporter: roles.includes("supporter"),
    staff: roles.includes("moderator") || roles.includes("admin"),
  };
}
