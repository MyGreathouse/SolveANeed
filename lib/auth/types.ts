export type AppRole = "requester" | "supporter" | "business_rep" | "moderator" | "admin";
export type AccountStatus = "active" | "suspended" | "deletion_requested";

export interface Viewer {
  id: string;
  email: string | null;
  displayName: string;
  accountStatus: AccountStatus;
  /** Raw role membership. Staff roles only take effect in the database at aal2. */
  roles: AppRole[];
  preferredCurrency: string;
  identityVerified: boolean;
  /** Authenticator assurance level of this session: aal1 = password, aal2 = MFA completed. */
  aal: "aal1" | "aal2";
  /** True when the member has at least one verified MFA factor. */
  mfaEnrolled: boolean;
}

export const isStaff = (v: Pick<Viewer, "roles">) => v.roles.includes("moderator") || v.roles.includes("admin");
