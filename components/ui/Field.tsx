import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Accessible form field wrapper: label, hint and error are wired via aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-semibold text-navy-900">
        {label}
        {required ? <span className="ml-1 text-danger-700" aria-hidden="true">*</span> : <span className="ml-1.5 font-normal text-muted">(optional)</span>}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="flex items-start gap-1.5 text-sm font-medium text-danger-700" role="alert">
          <span aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
    </div>
  );
}

/** Builds aria props for an input inside <Field>. */
export function fieldAria(id: string, opts: { hint?: boolean; error?: string }) {
  const describedBy = [opts.hint ? `${id}-hint` : null, opts.error ? `${id}-error` : null].filter(Boolean).join(" ");
  return {
    id,
    name: id,
    "aria-invalid": opts.error ? (true as const) : undefined,
    "aria-describedby": describedBy || undefined,
  };
}
