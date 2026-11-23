import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/PasswordForms";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold">Choose a new password</h1>
      <p className="mt-2 text-muted">For your security, you&apos;ll be signed out of your other devices.</p>
      <div className="mt-7"><ResetPasswordForm /></div>
    </>
  );
}
