import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Reset your password</h1>
      <p className="mt-2 text-muted">Enter your email and we&apos;ll send you a secure link.</p>
      <div className="mt-7"><ForgotPasswordForm /></div>
      <p className="mt-6 text-center text-sm"><Link href="/sign-in" className="font-semibold text-navy-900 underline">Back to sign in</Link></p>
    </>
  );
}
