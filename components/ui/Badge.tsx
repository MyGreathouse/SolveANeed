import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeTone = "neutral" | "info" | "warning" | "success" | "danger" | "gold" | "navy";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-navy-50 text-charcoal ring-navy-900/10",
  info: "bg-info-50 text-info-700 ring-info-700/15",
  warning: "bg-warning-50 text-warning-700 ring-warning-700/20",
  success: "bg-teal-50 text-teal-800 ring-teal-700/20",
  danger: "bg-danger-50 text-danger-700 ring-danger-700/20",
  gold: "bg-gold-50 text-gold-700 ring-gold-700/20",
  navy: "bg-navy-900 text-white ring-navy-900",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}
