"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { NavItem } from "./nav-config";

interface Group {
  title: string;
  items: NavItem[];
}

function isActive(pathname: string, href: string) {
  // Section roots are only active on their own page, not on every child page.
  if (href === "/admin" || href === "/dashboard/requester" || href === "/dashboard/supporter") return pathname === href;
  if (href === "/dashboard/requester/needs") return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.endsWith("/new"));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ groups, unread }: { groups: Group[]; unread: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = groups.flatMap((g) => g.items).find((i) => isActive(pathname, i.href));

  return (
    <nav aria-label="Dashboard">
      {/* Mobile: collapsible */}
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-line bg-white px-4 font-semibold text-navy-900 lg:hidden"
        aria-expanded={open}
        aria-controls="dashboard-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <span>{current?.label ?? "Menu"}</span>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      <div id="dashboard-nav" className={cn("mt-3 space-y-6 lg:mt-0 lg:block", open ? "block" : "hidden")}>
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted">{g.title}</p>
            <ul className="mt-2 space-y-0.5">
              {g.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm font-medium",
                        active ? "bg-navy-900 text-white" : "text-charcoal hover:bg-white",
                      )}
                    >
                      <span>{item.label}</span>
                      {item.planned && <span className={cn("rounded-full px-2 py-0.5 text-[0.65rem] font-semibold", active ? "bg-white/15 text-white" : "bg-navy-50 text-muted")}>Soon</span>}
                      {item.href === "/dashboard/notifications" && unread > 0 && (
                        <span className="rounded-full bg-gold-500 px-2 py-0.5 text-xs font-bold text-navy-900">
                          {unread}<span className="sr-only"> unread</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
