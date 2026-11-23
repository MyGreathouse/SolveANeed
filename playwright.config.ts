import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running SolveANeed instance connected to a
 * NON-PRODUCTION Supabase project (e.g. `supabase start`). See docs/TESTING.md.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /(public|a11y-signed-in)\.spec\.ts/ },
  ],
});
