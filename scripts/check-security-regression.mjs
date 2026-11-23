// Fails CI if any Phase 2.5 security finding (S1–S10) loses its regression test.
// Each ID must appear in at least one test title in tests/db or tests/integration,
// and those suites must run (they do, in the "database" and "stack" CI jobs).
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const files = ["tests/db", "tests/integration"].flatMap((d) =>
  readdirSync(path.join(root, d)).filter((f) => f.endsWith(".test.ts")).map((f) => path.join(root, d, f)),
);
const titles = files.flatMap((f) =>
  [...readFileSync(f, "utf8").matchAll(/(?:describe|it)\(\s*"([^"]+)"/g)].map((m) => m[1]),
);
const ids = Array.from({ length: 10 }, (_, i) => `S${i + 1}`);
const missing = ids.filter((id) => !titles.some((t) => new RegExp(`\\b${id}\\b`).test(t)));
for (const id of ids) {
  const n = titles.filter((t) => new RegExp(`\\b${id}\\b`).test(t)).length;
  console.log(`${id.padEnd(4)} ${n ? `✔ ${n} test group(s)/test(s)` : "✘ MISSING"}`);
}
if (missing.length) {
  console.error(`Security regression coverage missing for: ${missing.join(", ")}`);
  process.exit(1);
}
