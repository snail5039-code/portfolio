import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  page.on("dialog", (dialog) => dialog.dismiss());
});

test("비로그인 사용자는 학생 보호 경로에서 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/student");
  await expect(page).toHaveURL(/\/auth\?mode=STUDENT$/);
});

test("비로그인 사용자는 교사 보호 경로에서 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/teacher");
  await expect(page).toHaveURL(/\/auth\?mode=TEACHER$/);
});

test("비로그인 사용자는 관리자 보호 경로에서 로그인 화면으로 이동한다", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/auth\?mode=ADMIN$/);
});

test("홈 화면의 핵심 진입점은 현재 뷰포트에서 사용할 수 있다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /정답보다/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /학생으로 시작/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /교사로 시작/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /관리자 로그인/ })).toBeVisible();
});
