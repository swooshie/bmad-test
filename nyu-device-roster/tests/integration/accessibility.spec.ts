import fs from "fs";
import path from "path";
import { AxeBuilder } from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const baseUrl = process.env.APP_ENGINE_URL ?? "http://localhost:3000";
const outputDir = path.resolve(process.cwd(), "artifacts/accessibility");

const targets = [
  { name: "dashboard", path: "/" },
  { name: "devices", path: "/devices" },
  { name: "anonymization-toggle", path: "/devices" },
  { name: "sync-status", path: "/dashboard" },
];

test.beforeAll(async () => {
  await fs.promises.mkdir(outputDir, { recursive: true });
});

const skipIfUnavailable = async (page: Page) => {
  const is404 = await page
    .getByRole("heading", { name: "404" })
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (is404) {
    test.skip(true, "Route returned 404");
  }

  const accessDenied = await page
    .getByRole("heading", { name: /Access denied/i })
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (accessDenied) {
    test.skip(true, "Access denied page rendered (missing session/allowlist)");
  }

  const secretError = await page
    .getByText(/Secret "syncSchedulerToken" is not configured/i)
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (secretError) {
    test.skip(true, "Secrets not configured in environment");
  }
};

for (const target of targets) {
  test(`axe-core accessibility audit: ${target.name}`, async ({ page }) => {
    await page.goto(`${baseUrl}${target.path}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1500);

    await skipIfUnavailable(page);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const timestamp = new Date().toISOString().replace(/[:]/g, "-");
    const fileBase = `${target.name}-axe-${timestamp}`;
    await fs.promises.writeFile(
      path.join(outputDir, `${fileBase}.json`),
      JSON.stringify(results, null, 2)
    );

    const criticalOrSerious = results.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? "")
    );

    expect(criticalOrSerious.length).toBe(0);
  });
}
