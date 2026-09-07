import { expect, test, type Page } from "@playwright/test";

const TEST_PASSWORD = "Swoosh-E2E-2026";

const DASHBOARD_ROUTES = [
  ["Dashboard", "/dashboard"],
  ["API Keys", "/dashboard/manage-apikey"],
  ["Providers", "/dashboard/provider"],
  ["Combos", "/dashboard/combo"],
  ["Proxy", "/dashboard/proxy"],
  ["Usage", "/dashboard/usage"],
  ["Quota Monitor", "/dashboard/quota-monitor"],
  ["CLI Tools", "/dashboard/cli-tools"],
  ["Swoosh Chat", "/dashboard/swoosh-chat"],
  ["Settings", "/dashboard/settings"],
  ["Console Logs", "/dashboard/console-log"],
] as const;

async function expectHealthyDashboard(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(`${path.replaceAll("/", "\\/")}$`));
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText("Backend unavailable", { exact: true })).toHaveCount(0);

  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(overflow.document, `${path} must not overflow the viewport`).toBeLessThanOrEqual(
    overflow.viewport + 1,
  );
}

test("fresh install login and every dashboard screen work across viewport sizes", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const serverErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().startsWith("http://127.0.0.1:14145/") && response.status() >= 500) {
      serverErrors.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/login");
  await expect(page.getByText("Dashboard login", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Password").fill("123456");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page).toHaveURL(/\/setup$/);
  await page.getByPlaceholder("Password").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: "Set Password & Continue" }).click();
  await expectHealthyDashboard(page, "/dashboard");

  for (const [label, path] of DASHBOARD_ROUTES) {
    await page.getByRole("link", { name: label, exact: true }).click();
    await expectHealthyDashboard(page, path);
  }

  for (const viewport of [
    { name: "tablet", width: 834, height: 1194 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const [, path] of DASHBOARD_ROUTES) {
      await test.step(`${viewport.name}: ${path}`, async () => {
        await page.goto(path);
        await expectHealthyDashboard(page, path);
      });
    }
  }

  expect(pageErrors, "uncaught browser errors").toEqual([]);
  expect(serverErrors, "local API responses with status 5xx").toEqual([]);
});
