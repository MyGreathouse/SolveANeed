"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MAIN_NAV } from "./nav";
import { buttonClass } from "@/components/ui/Button";

export function MobileNav({ signedIn, footer }: { signedIn: boolean; footer?: ReactNode }) {
  const pathname = usePathname();
  // The menu is "open for a given path", so navigating automatically closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) => {
    const next = typeof v === "function" ? v(open) : v;
    setOpenPath(next ? pathname : null);
  };
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenPath(null);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        className="grid size-11 place-items-center rounded-full text-white hover:bg-white/10"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          className="fixed inset-x-0 top-[4.5rem] bottom-0 z-40 overflow-y-auto bg-navy-900 px-5 pb-10 pt-4 on-navy"
        >
          <nav aria-label="Mobile">
            <ul className="divide-y divide-white/10">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-14 items-center text-lg font-semibold text-white"
                    aria-current={pathname === item.href ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-8 grid gap-3">
            {signedIn ? (
              <>
                <Link href="/dashboard" className={buttonClass("gold", "lg")}>
                  Go to dashboard
                </Link>
                {footer}
              </>
            ) : (
              <>
                <Link href="/get-started" className={buttonClass("gold", "lg")}>
                  Get Started
                </Link>
                <Link href="/sign-in" className={buttonClass("outline-light", "lg")}>
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
