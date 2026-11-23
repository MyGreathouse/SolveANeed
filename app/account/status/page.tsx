import type { Metadata } from "next";
import { getViewer } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/Button";
import { SignOutButton } from "@/components/auth/SignOutButton";

export const metadata: Metadata = { title: "Account status", robots: { index: false } };

export default async function AccountStatusPage({ searchParams }: PageProps<"/account/status">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const deleted = sp.deleted === "1" || viewer?.accountStatus === "deletion_requested";
  return (
    <main className="flex flex-1 items-center bg-soft py-20">
      <div className="container-page max-w-xl">
        <div className="card p-8 text-center" role="status">
          <h1 className="text-2xl font-extrabold">{deleted ? "Your account deletion request has been received" : viewer?.accountStatus === "suspended" ? "Your account is suspended" : "Account status"}</h1>
          <p className="mt-3 text-muted">
            {deleted
              ? "Your profile has been anonymised and your needs withdrawn. Remaining data will be removed once any legally required retention period ends."
              : viewer?.accountStatus === "suspended"
                ? "A moderator has suspended this account. If you believe this is a mistake, you can appeal by contacting our support team."
                : "Your account is active."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <ButtonLink href="/" variant="navy">Go to homepage</ButtonLink>
            {viewer && <SignOutButton className="inline-flex min-h-11 items-center rounded-full border border-navy-900/25 px-5 font-semibold text-navy-900" />}
          </div>
        </div>
      </div>
    </main>
  );
}
