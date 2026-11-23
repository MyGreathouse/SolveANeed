import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { getViewer } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/redirects";
import { NotConfiguredNotice } from "@/components/auth/NotConfiguredNotice";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  const sp = await searchParams;
  if (await getViewer()) redirect("/dashboard");
  const intent = sp.intent === "need" || sp.intent === "help" ? sp.intent : "both";
  const next = typeof sp.next === "string" ? safeNextPath(sp.next) : undefined;
  return (
    <>
      <p className="eyebrow">Join SolveANeed</p>
      <h1 className="mt-2 text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-muted">Free to join. One account for giving and receiving help. Adults aged 18+ only.</p>
      <NotConfiguredNotice />
      <div className="mt-7">
        <SignUpForm defaultIntent={intent} next={next} />
      </div>
    </>
  );
}
