import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const tones = {
  info: "border-info-700/20 bg-info-50 text-[#1e3a8a]",
  success: "border-teal-700/25 bg-teal-50 text-teal-800",
  warning: "border-warning-700/25 bg-warning-50 text-warning-700",
  danger: "border-danger-700/25 bg-danger-50 text-danger-700",
} as const;

const icons = { info: "ℹ", success: "✓", warning: "!", danger: "⚠" } as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
  live = false,
}: {
  tone?: keyof typeof tones;
  title?: string;
  children?: ReactNode;
  className?: string;
  live?: boolean;
}) {
  return (
    <div
      className={cn("flex gap-3 rounded-2xl border px-4 py-3.5 text-sm", tones[tone], className)}
      role={live ? (tone === "danger" ? "alert" : "status") : undefined}
    >
      <span aria-hidden="true" className="mt-px grid size-5 shrink-0 place-items-center rounded-full bg-current/10 text-xs font-bold">
        {icons[tone]}
      </span>
      <div className="space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
