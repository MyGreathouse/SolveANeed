import { signOutAction } from "@/app/(auth)/actions";

export function SignOutButton({ className, label = "Sign out" }: { className?: string; label?: string }) {
  return (
    <form action={signOutAction}>
      <button type="submit" className={className}>
        {label}
      </button>
    </form>
  );
}
