import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
  tone = "white",
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  tone?: "white" | "soft" | "navy";
  className?: string;
}) {
  const titleId = id ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-20 py-16 md:py-24",
        tone === "white" && "bg-white",
        tone === "soft" && "bg-soft",
        tone === "navy" && "bg-navy-900 text-white on-navy",
        className,
      )}
    >
      <div className="container-page">
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2 id={titleId} className={cn("mt-3 text-3xl font-extrabold md:text-4xl", tone === "navy" && "text-white")}>
            {title}
          </h2>
          <div className="gold-rule mt-5" aria-hidden="true" />
          {intro && <div className={cn("mt-5 text-lg leading-relaxed", tone === "navy" ? "text-on-navy-muted" : "text-muted")}>{intro}</div>}
        </div>
        <div className="mt-12">{children}</div>
      </div>
    </section>
  );
}
