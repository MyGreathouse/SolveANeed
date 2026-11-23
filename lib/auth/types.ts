export type AppRole = "requester" | "supporter" | "business_rep" | "moderator" | "admin";
export type AccountStatus = "active" | "suspended" | "deletion_requested";

export interface Viewer {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  accountStatus: AccountStatus;
  roles: AppRole[];
  preferredCurrency: string;
  identityVerified: boolean;
}

export const isStaff = (v: Pick<Viewer, "roles">) => v.roles.includes("moderator") || v.roles.includes("admin");
