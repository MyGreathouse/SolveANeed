/** Server-side file checks: declared type, size AND magic bytes must agree. */
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;

const SIGNATURES: Record<string, { ext: string; test: (b: Uint8Array) => boolean }> = {
  "application/pdf": { ext: "pdf", test: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 },
  "image/png": { ext: "png", test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  "image/jpeg": { ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/webp": {
    ext: "webp",
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
};

export type FileCheck = { ok: true; mime: string; ext: string } | { ok: false; error: string };

export function checkEvidenceFile(declaredType: string, size: number, head: Uint8Array): FileCheck {
  if (size <= 0) return { ok: false, error: "The file is empty." };
  if (size > EVIDENCE_MAX_BYTES) return { ok: false, error: "Files must be 10 MB or smaller." };
  const sig = SIGNATURES[declaredType];
  if (!sig) return { ok: false, error: "Upload a PDF, JPG, PNG or WebP file." };
  if (!sig.test(head)) return { ok: false, error: "This file's contents don't match its type. Please upload a genuine PDF or image." };
  return { ok: true, mime: declaredType, ext: sig.ext };
}

/** Keeps a display-safe file name (no paths, control chars or odd characters). */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, " ").trim();
  return (cleaned || "file").slice(0, 120);
}
