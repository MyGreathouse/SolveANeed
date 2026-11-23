import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("public site", () => {
  test("homepage shows the brand, hero and all sections", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/SolveANeed — Every Need Deserves a Solution\./);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Every Need Deserves a Solution\./);
    for (const name of [
      /Simple for people who need help/,
      /Help isn't one-size-fits-all/,
      /Real needs, reviewed by people/,
      /Two sides\. One trusted marketplace/,
      /Built to be trusted/,
      /Purpose-led businesses/,
      /Questions, answered honestly/,
      /Your first step takes two minutes/,
    ]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    // Brand spelling: never "SolveNeed" / "Solveneed" in visible text.
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/\bSolve ?Need\b|\bSolveneed\b|PROBLM/);
  });

  test("primary hero buttons lead to working onboarding journeys", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "I Need Help" }).first().click();
    await expect(page).toHaveURL(/\/get-started\?path=need/);
    await page.getByRole("link", { name: /Create account & post a need/ }).click();
    await expect(page).toHaveURL(/\/sign-up\?intent=need/);
    await expect(page.getByRole("radio", { name: /I need help/ })).toBeChecked();

    await page.goto("/");
    await page.getByRole("link", { name: "I Want to Help" }).first().click();
    await expect(page).toHaveURL(/\/get-started\?path=help/);
  });

  test("every header and footer link resolves", async ({ page, request }) => {
    await page.goto("/");
    const hrefs = await page.locator("header a[href^='/'], footer a[href^='/']").evaluateAll((els) =>
      [...new Set(els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!.split("#")[0] || "/"))],
    );
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) {
      const res = await request.get(href);
      expect(res.status(), href).toBeLessThan(400);
    }
  });

  test("explore page renders filters and an honest empty state or real listings", async ({ page }) => {
    await page.goto("/needs?category=not-a-category&currency=xx");
    await expect(page.getByRole("form", { name: "Filter needs" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /needs?( match your filters)?$/ })).toBeVisible();
  });

  test("dashboard requires sign-in", async ({ page }) => {
    await page.goto("/dashboard/requester/needs/new");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard%2Frequester%2Fneeds%2Fnew/);
  });

  test("security headers are present", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  for (const path of ["/", "/needs", "/how-it-works", "/get-started", "/sign-up", "/sign-in", "/earn", "/legal/terms"]) {
    test(`no WCAG 2.2 A/AA violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`);
      expect(summary).toEqual([]);
    });
  }
});

test("mobile menu opens, traps focus start and closes with Escape", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Open menu" });
  await toggle.click();
  const nav = page.getByRole("navigation", { name: "Mobile" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Explore Needs" })).toBeFocused();
  // The whole panel must be usable, not clipped by the header.
  await expect(nav.getByRole("link", { name: "For Businesses" })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Get Started" })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(nav).toBeHidden();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
});
