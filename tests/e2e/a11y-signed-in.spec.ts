import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signUpAndVerify, uniqueEmail } from "./support";

/** Accessibility of signed-in forms and navigation on desktop AND mobile. */
test.describe("signed-in accessibility", () => {
  test("dashboard pages and forms have no WCAG 2.2 A/AA violations and are keyboard reachable", async ({ page, isMobile }) => {
    await signUpAndVerify(page, { name: "Access Tester", email: uniqueEmail(isMobile ? "a11ym" : "a11yd"), intent: "both" });
    for (const path of [
      "/dashboard/requester",
      "/dashboard/requester/needs/new",
      "/dashboard/supporter",
      "/dashboard/supporter/preferences",
      "/dashboard/settings",
      "/dashboard/notifications",
    ]) {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(" | ")}`)).toEqual([]);
    }

    // Keyboard: the need form's first field is reachable and labelled.
    await page.goto("/dashboard/requester/needs/new");
    await page.getByLabel("Title").focus();
    await expect(page.getByLabel("Title")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Category")).toBeFocused();

    if (isMobile) {
      // The dashboard menu collapses on mobile and opens with an accessible toggle.
      const toggle = page.getByRole("button", { name: /Create a Need|Menu/ }).first();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("link", { name: "My Needs" })).toBeInViewport();
    }
  });
});
