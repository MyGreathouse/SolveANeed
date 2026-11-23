import { cn } from "@/lib/utils/cn";

/** Accessible funding progress. Value is in basis points (0–10000). Text label is always shown, so colour is never the only cue. */
export function ProgressBar({ basisPoints, label, className }: { basisPoints: number; label: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.floor(basisPoints / 100)));
  return (
    <div className={className}>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-navy-100"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={label}
      >
        <div className={cn("h-full rounded-full bg-teal-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
