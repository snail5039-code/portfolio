"use client";

/**
 * 라이트/다크 토글.
 *
 * 상태를 React가 아니라 <html data-theme>과 CSS로만 들고 있다. 그래야
 * 서버 렌더(항상 다크 기준)와 클라이언트가 어긋나도 하이드레이션 경고가
 * 나지 않는다 — 실제 값은 app/[locale]/layout.tsx의 인라인 스크립트가
 * 페인트 전에 이미 맞춰놓는다. 라벨 두 개를 다 그려놓고 CSS로 하나만 보인다.
 */
export function ThemeToggle({ label }: { label: string }) {
  function toggle() {
    const root = document.documentElement;
    const goingLight = root.getAttribute("data-theme") !== "light";
    if (goingLight) root.setAttribute("data-theme", "light");
    else root.removeAttribute("data-theme");
    try {
      localStorage.setItem("theme", goingLight ? "light" : "dark");
    } catch {
      // 프라이빗 모드 등에서 막히면 그냥 이번 방문만 적용된다
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      className="grid size-[30px] shrink-0 place-items-center border border-transparent font-mono text-[13px] text-dim transition-colors hover:text-ink"
    >
      {/* 단어 대신 모노스페이스 기호 한 글자 — 좁은 화면에서 네비바가 줄바꿈되던 것을 고쳤다 */}
      <span data-theme-label="dark">☀</span>
      <span data-theme-label="light">☾</span>
    </button>
  );
}
