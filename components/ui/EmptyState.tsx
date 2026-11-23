import type { ReactNode } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col items-center px-6 py-12 text-center md:py-16", className)}>
      <div className="mb-5 grid size-16 place-items-center rounded-2xl bg-navy-900">
        {icon ?? <LogoMark className="h-8 w-9" />}
      </div>
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-2 max-w-md text-muted">{description}</div>
      {action && <div className="mt-6 flex flex-wrap justify-center gap-3">{action}</div>}
    </div>
  );
}
