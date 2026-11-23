import { cn } from "@/lib/utils/cn";

type Variant = "dark" | "light";

/**
 * SolveANeed heart-and-handshake mark.
 * "dark" = for navy backgrounds (gold + white); "light" = for light backgrounds (gold + navy).
 */
export function LogoMark({ variant = "dark", className, title }: { variant?: Variant; className?: string; title?: string }) {
  const second = variant === "dark" ? "#FFFFFF" : "#10223B";
  const gold = "#D6AA52";
  return (
    <svg
      viewBox="0 0 64 56"
      fill="none"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      focusable="false"
    >
      <path d="M32 50 C20 41 7 32.5 7 20.5 C7 12.5 12.8 6.5 20 6.5 C25.5 6.5 29.6 9.6 32 14" stroke={gold} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 14 C34.4 9.6 38.5 6.5 44 6.5 C51.2 6.5 57 12.5 57 20.5 C57 32.5 44 41 32 50" stroke={second} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 31 L27 22.5 C28.6 21.2 30.8 21.2 32.3 22.6 L35.5 25.5" stroke={second} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M47 25 L41.5 21.5 C40 20.6 38 20.8 36.8 22 L30.5 28.3 C29.5 29.3 29.6 30.9 30.7 31.8 C31.7 32.6 33.2 32.5 34.1 31.6 L36.3 29.4" stroke={gold} strokeWidth="4.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M36.3 29.4 L42.2 35 M33.2 33.6 L38.2 38.4 M29.8 36.8 L34 40.8" stroke={gold} strokeWidth="4.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The official wordmark: Solve + A (gold) + Need = SolveANeed.
 * Rendered as live text so it is crisp, accessible and always spelled correctly.
 */
export function Wordmark({ variant = "dark", className }: { variant?: Variant; className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-extrabold tracking-[-0.03em] leading-none",
        variant === "dark" ? "text-white" : "text-navy-900",
        className,
      )}
    >
      Solve<span className="text-gold-500">A</span>Need
    </span>
  );
}

export function Logo({
  variant = "dark",
  size = "md",
  showTagline = false,
  className,
}: {
  variant?: Variant;
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
}) {
  const sizes = {
    sm: { mark: "h-7 w-8", text: "text-xl" },
    md: { mark: "h-8 w-9", text: "text-2xl" },
    lg: { mark: "h-11 w-12", text: "text-3xl" },
    xl: { mark: "h-16 w-[4.5rem]", text: "text-5xl" },
  }[size];
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)} aria-label="SolveANeed" role="img">
      <LogoMark variant={variant} className={cn(sizes.mark, "shrink-0")} />
      <span className="flex flex-col" aria-hidden="true">
        <Wordmark variant={variant} className={sizes.text} />
        {showTagline && (
          <span className={cn("mt-1 text-[0.7rem] font-medium tracking-wide", variant === "dark" ? "text-white/85" : "text-muted")}>
            Every Need Deserves a Solution.
          </span>
        )}
      </span>
    </span>
  );
}
