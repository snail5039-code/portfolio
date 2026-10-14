import { expect, test } from "@playwright/test";

test("dashboard shows portfolio summary, holdings and a pending decision", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("h1")).toContainText("원"); // formatted 총자산 amount, e.g. "128,450,000원"

  await expect(page.getByRole("heading", { name: /보유 종목/ })).toBeVisible();
  await expect(page.locator("table tbody tr").first()).toBeVisible();

  // The inspector panel shows the current fixture decision with a live status pill.
  await expect(page.getByText("현재 판단")).toBeVisible();
  await expect(page.getByText("DEC-", { exact: false }).first()).toBeVisible();

  await expect(page.getByText("모의투자 · 가상 예시").first()).toBeVisible();
});
