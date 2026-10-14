import { expect, test } from "@playwright/test";

test("sidebar navigation switches the active screen", async ({ page }) => {
  await page.goto("/");

  const nav = (label: string) => page.locator(`[data-nav-label="${label}"]`);

  await expect(nav("포트폴리오")).toHaveAttribute("aria-current", "page");

  await nav("기업 상세").click();
  await expect(nav("기업 상세")).toHaveAttribute("aria-current", "page");
  await expect(nav("포트폴리오")).not.toHaveAttribute("aria-current", "page");
  await expect(page.locator(".titlebar strong")).not.toHaveText("");

  await nav("승인 대기").click();
  await expect(nav("승인 대기")).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "승인 대기" })).toBeVisible();

  await nav("감사 로그").click();
  await expect(nav("감사 로그")).toHaveAttribute("aria-current", "page");

  await nav("포트폴리오").click();
  await expect(nav("포트폴리오")).toHaveAttribute("aria-current", "page");
});
