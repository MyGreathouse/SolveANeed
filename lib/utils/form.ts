import type { z } from "zod";

export type FormState<F extends string = string> = {
  ok?: boolean;
  message?: string;
  errors?: Partial<Record<F | "form", string>>;
  values?: Record<string, string>;
};

/** Flattens zod issues to the first message per field. */
export function zodErrors<F extends string>(error: z.ZodError): Partial<Record<F | "form", string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out as Partial<Record<F | "form", string>>;
}

export const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v : "";
};
