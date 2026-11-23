import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/check-email">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 254) : null;
  return (
    <div role="status">
      <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700" aria-hidden="true">✉</div>
      <h1 className="text-3xl font-extrabold">Verify your email</h1>
      <p className="mt-3 text-charcoal">
        We&apos;ve sent a verification link{email ? <> to <strong className="break-all">{email}</strong></> : null}. Open it to activate your account.
      </p>
      <ul className="mt-5 list-disc space-y-1.5 pl-5 text-sm text-muted">
        <li>The link expires after 24 hours.</li>
        <li>Can&apos;t find it? Check your spam or promotions folder.</li>
        <li>If you already have an account, you can simply sign in.</li>
      </ul>
      <p className="mt-7 text-sm"><Link href="/sign-in" className="font-semibold text-navy-900 underline">Go to sign in</Link></p>
    </div>
  );
}
