import { expect, test } from "@playwright/test";

/**
 * The dev/test environment has no OPENDART_API_KEY configured, so the "live
 * filings" path (app/routers/company_detail.py's `_with_live_filings`) never
 * actually runs against this suite's backend. This test simulates that path
 * by intercepting the real response and overwriting just the fields a
 * successful OpenDART call would change, then checks the frontend renders
 * the "connected" copy instead of the "미연결" fallback copy — the one thing
 * that's easy to get wrong when a screen's disclaimer depends on live state.
 */
test("company detail shows OpenDART-connected copy when filingsConnected is true", async ({ page }) => {
  await page.route("**/api/company-detail", async (route) => {
    const response = await route.fetch();
    const body = await response.json();

    body.externalConnections = 1;
    body.disclaimer = "모의투자 · 가상 예시 · 시세·계좌 미연결 · 공시는 OpenDART 실제 데이터 · 투자 권유 아님";
    body.data.filingsConnected = true;
    body.data.filings = [
      {
        id: "20260101000123",
        kind: "filing",
        title: "분기보고서",
        subtitle: "2026.01.01 · 삼성전자",
        body: "OpenDART 실제 공시입니다. 접수번호 20260101000123",
        sourceLabel: "OpenDART 실제 공시",
        tone: "neutral"
      }
    ];

    await route.fulfill({ response, json: body });
  });

  await page.goto("/");
  await page.locator('[data-nav-label="기업 상세"]').click();
  await expect(page.getByRole("heading", { name: "삼성전자" })).toBeVisible();

  await expect(page.locator(".filings .company-section-label span")).toHaveText("OpenDART 실제 공시 연결");
  await expect(page.getByRole("option", { name: /분기보고서/ })).toBeVisible();
  await expect(page.locator(".filing-warning")).toContainText("OpenDART 실제 공시 목록");
  await expect(page.locator(".company-inspector-actions p")).toContainText("공시는 OpenDART 실제 연결");

  await page.getByRole("option", { name: /분기보고서/ }).click();
  await expect(page.getByText("OpenDART 실제 공시 · 선택됨")).toBeVisible();
});
