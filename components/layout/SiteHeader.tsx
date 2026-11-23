import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { getViewer } from "@/lib/auth/session";
import { MAIN_NAV } from "./nav";
import { MobileNav } from "./MobileNav";
import { SignOutButton } from "@/components/auth/SignOutButton";

async function AccountActions() {
  const viewer = await getViewer();
  if (viewer) {
    return (
      <>
        <div className="hidden items-center gap-2 lg:flex">
          <ButtonLink href="/dashboard" variant="gold" size="sm">
            Dashboard
          </ButtonLink>
          <SignOutButton className="text-sm font-semibold text-white/85 hover:text-white px-3 min-h-9" />
        </div>
        <MobileNav signedIn footer={<SignOutButton className={buttonClass("outline-light", "lg", "w-full")} />} />
      </>
    );
  }
  return (
    <>
      <div className="hidden items-center gap-2 lg:flex">
        <Link href="/sign-in" className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-white/90 hover:text-white">
          Sign In
        </Link>
        <ButtonLink href="/get-started" variant="gold" size="sm">
          Get Started
        </ButtonLink>
      </div>
      <MobileNav signedIn={false} />
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy-900 on-navy">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" className="rounded-lg" aria-label="SolveANeed home">
          <Logo size="sm" />
        </Link>
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {MAIN_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-medium text-white/85 hover:bg-white/10 hover:text-white">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-1">
          <Suspense fallback={<div className="h-9 w-40" aria-hidden="true" />}>
            <AccountActions />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
