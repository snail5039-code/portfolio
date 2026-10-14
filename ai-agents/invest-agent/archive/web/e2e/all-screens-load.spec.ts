import { expect, test } from "@playwright/test";

/**
 * A broad, shallow regression net over all 23 screens, complementing the
 * deeper flow-specific specs. For each sidebar item this only checks that the
 * screen actually rendered its data (no `FixtureFallback` error screen, no
 * uncaught JS exception) — not screen-specific content, which the other specs
 * already cover for the highest-traffic screens.
 */
const NAV_LABELS = [
  "포트폴리오",
  "기업 상세",
  "계좌",
  "거래 내역",
  "세금·수수료",
  "리스크 알림",
  "백테스트",
  "전략 조정",
  "변경 비교",
  "근거 패킷",
  "스트레스 테스트",
  "포트폴리오 건강",
  "분석 에이전트",
  "검증 에이전트",
  "실행 에이전트",
  "승인 대기",
  "역할 상태",
  "투자 리포트",
  "감사 로그",
  "결정 회고",
  "투자 정책",
  "알림 설정",
  "데이터 연결"
];

test("every sidebar screen loads its data without an error screen or a JS exception", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");

  for (const label of NAV_LABELS) {
    const navItem = page.locator(`[data-nav-label="${label}"]`);
    await navItem.click();
    await expect(navItem).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".error-screen")).toHaveCount(0);
    await expect(page.locator(".loading-screen")).toHaveCount(0);
  }

  expect(pageErrors, `uncaught JS exceptions while visiting every screen: ${pageErrors.join("; ")}`).toEqual([]);
});
