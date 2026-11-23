import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/SignInForm";
import { Alert } from "@/components/ui/Alert";
import { getViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirects";
import { NotConfiguredNotice } from "@/components/auth/NotConfiguredNotice";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? safeNextPath(sp.next) : undefined;
  if (await getViewer()) redirect(next ?? "/dashboard");
  return (
    <>
      <p className="eyebrow">Welcome back</p>
      <h1 className="mt-2 text-3xl font-extrabold">Sign in to SolveANeed</h1>
      {sp.error === "link-invalid" && (
        <Alert tone="warning" className="mt-5" title="That link has expired or was already used">
          Please sign in, or request a new link.
        </Alert>
      )}
      <NotConfiguredNotice />
      <div className="mt-7">
        <SignInForm next={next} />
      </div>
    </>
  );
}
