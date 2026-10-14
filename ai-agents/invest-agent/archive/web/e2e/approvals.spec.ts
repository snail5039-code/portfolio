import { expect, test } from "@playwright/test";

/**
 * The approval store is an in-memory dict seeded fresh per test-server
 * process (see playwright.config.ts), so every order starts "pending" and
 * the fixture's 4 orders are exactly DEC-1042/1043/1044/1045 in that order.
 * These tests approve/reject real orders and are NOT safe to run twice
 * against the same server instance.
 */

test("approving and rejecting orders updates the row, the sidebar badge and the queue count", async ({ page }) => {
  await page.goto("/");

  const badge = page.locator('[data-nav-label="승인 대기"] b');
  await expect(badge).toHaveText("4");

  await page.locator('[data-nav-label="승인 대기"]').click();
  await expect(page.getByRole("heading", { name: "승인 대기" })).toBeVisible();
  await expect(page.getByText("4건", { exact: false })).toBeVisible();

  // DEC-1042 (삼성전자) is selected by default as the first row.
  await page.getByRole("button", { name: /한도 내 모의승인/ }).click();
  await expect(page.getByRole("button", { name: /DEC-1042 삼성전자 주문 선택/ })).toContainText("모의승인됨");
  await expect(badge).toHaveText("3");

  // Select DEC-1043 (NAVER) and reject it.
  await page.getByRole("button", { name: /DEC-1043 NAVER 주문 선택/ }).click();
  await page.getByRole("button", { name: "반려" }).click();
  await expect(page.getByRole("button", { name: /DEC-1043 NAVER 주문 선택/ })).toContainText("반려됨");
  await expect(badge).toHaveText("2");

  // Re-selecting the approved order shows its decision message instead of
  // action buttons.
  await page.getByRole("button", { name: /DEC-1042 삼성전자 주문 선택/ }).click();
  await expect(page.getByText(/모의승인됨 ·.*실제 주문은 생성되지 않았습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "반려" })).toBeDisabled();
});
