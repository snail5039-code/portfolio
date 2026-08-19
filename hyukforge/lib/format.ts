/** 파일 크기. 표에 들어가므로 자릿수를 일정하게 유지한다. */
export function fileSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / 1_048_576;
  if (mb < 1) return `${(bytes / 1024).toFixed(0)} KB`;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * 날짜는 언제나 한국 시간으로 찍는다.
 *
 * `getFullYear()` 류는 **서버의 시간대**를 쓴다. 로컬은 KST 라서 맞았는데
 * Vercel 은 UTC 라서, 밤 9시 이후에 발행한 것이 배포본에서 하루 앞으로 보였다.
 * 오늘 올린 공지가 어제 것으로 뜨는 식이다.
 *
 * 방문자의 시간대로 맞추지 않는 이유는, 이 날짜들이 "내가 언제 올렸나" 이지
 * "당신에게 몇 시인가" 가 아니기 때문이다. 기준을 하나로 못박아야
 * 개발 기록·릴리스·공지의 날짜가 서로 어긋나지 않는다.
 */
const KST = "Asia/Seoul";

function parts(iso: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA 는 2026-08-19 꼴로 준다. 자리별로 꺼내는 것보다 쪼개는 게 짧다.
  const [y, m, d] = f.format(new Date(iso)).split("-");
  return { y, m, d };
}

/** 2026.08.16 — 모노스페이스로 찍히므로 구분자를 점으로 통일한다. */
export function shortDate(iso: string | null): string {
  if (!iso) return "—";
  const { y, m, d } = parts(iso);
  return `${y}.${m}.${d}`;
}

/** 08.16 — 통계 칸처럼 좁은 자리에서 쓴다. */
export function monthDay(iso: string | null): string {
  if (!iso) return "—";
  const { m, d } = parts(iso);
  return `${m}.${d}`;
}

export function platformLabel(platforms: string[]): string {
  if (!platforms.length) return "—";
  const names: Record<string, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    android: "Android",
    ios: "iOS",
  };
  return platforms.map((p) => names[p] ?? p).join(" · ");
}

/** 분류색은 태그 테두리·글자에만 쓴다. 배경으로 칠하지 않는다. (docs/DESIGN.md) */
export const categoryVar: Record<string, string> = {
  office: "--color-office",
  games: "--color-games",
  utilities: "--color-utils",
  webapps: "--color-webapp",
  labs: "--color-labs",
};
