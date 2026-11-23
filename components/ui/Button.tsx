import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type ButtonVariant = "gold" | "navy" | "teal" | "white" | "outline" | "outline-light" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors duration-150 " +
  "disabled:cursor-not-allowed disabled:opacity-60 select-none whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  gold: "bg-gold-500 text-navy-900 hover:bg-gold-300 shadow-[0_6px_20px_-8px_rgb(214_170_82/0.7)]",
  navy: "bg-navy-900 text-white hover:bg-navy-800",
  teal: "bg-teal-700 text-white hover:bg-teal-800",
  white: "bg-white text-navy-900 hover:bg-navy-50 shadow-[0_6px_20px_-10px_rgb(0_0_0/0.4)]",
  outline: "border border-navy-900/25 bg-white text-navy-900 hover:border-navy-900 hover:bg-navy-50",
  "outline-light": "border border-white/40 text-white hover:border-white hover:bg-white/10",
  ghost: "text-navy-900 hover:bg-navy-50",
  danger: "bg-danger-700 text-white hover:bg-[#912018]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-sm",
  md: "min-h-11 px-5 text-[0.95rem]",
  lg: "min-h-13 px-7 text-base md:text-lg",
};

export function buttonClass(variant: ButtonVariant = "navy", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type CommonProps = { variant?: ButtonVariant; size?: ButtonSize; className?: string; children: ReactNode };

export function Button({ variant, size, className, children, type = "button", ...rest }: CommonProps & ComponentProps<"button">) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, className, children, ...rest }: CommonProps & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}
