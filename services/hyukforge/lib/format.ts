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

/**
 * 오늘(KST)을 2026-09-18 꼴로. 날짜별 집계의 기준이 되는 값이다.
 *
 * DB 쪽 record_visit()·record_hit() 이 `now() at time zone 'Asia/Seoul'` 로
 * 날짜를 만든다. 화면에서 "최근 30일"을 자를 때 같은 기준을 써야
 * 자정 근처에서 하루가 어긋나지 않는다.
 */
export function kstDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 08.16 — 통계 칸처럼 좁은 자리에서 쓴다. */
export function monthDay(iso: string | null): string {
  if (!iso) return "—";
  const { m, d } = parts(iso);
  return `${m}.${d}`;
}

/** 2026.08.16 14:32 — 이력처럼 시각까지 알아야 하는 자리에서 쓴다. */
export function stamp(iso: string | null): string {
  if (!iso) return "—";
  const { y, m, d } = parts(iso);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: KST,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `${y}.${m}.${d} ${time}`;
}

/**
 * 본문 첫 문단만. 마크다운을 렌더하지 않는 자리에서 쓴다 — 문단 구분만 본다.
 *
 * 홈의 공지 패널과 공지 목록이 같이 쓴다. 두 벌로 두면 한쪽만 고쳐져서
 * 같은 공지가 자리마다 다르게 잘린다.
 */
export function lead(body: string, max = 96): string {
  const first = body.split("\n\n")[0].replace(/\s+/g, " ").trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}

export function platformLabel(platforms: string[]): string {
  if (!platforms.length) return "—";
  const names: Record<string, string> = {
    windows: "Windows",
    macos: "macOS",
    linux: "Linux",
    android: "Android",
    ios: "iOS",
    // 브라우저에서 도는 제품. kind='webapp' 은 화면이 따로 "Web" 을 쓰지만,
    // 소스만 공개한 웹 제품(kind='source')은 이 표를 탄다.
    web: "Web",
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

/**
 * 링크로 찍을 주소의 표시용 이름.
 *
 * 사양표 한 칸에 들어가야 하니 프로토콜과 github.com 은 떼어낸다.
 * 남는 것은 'snail5039-code/lastcall' 처럼 저장소 이름 그대로다.
 */
export function linkLabel(url: string): string {
  return url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/^github\.com\//, "")
    .replace(/\/$/, "");
}

/**
 * 표 한 칸에 들어갈 만큼 짧게 — 어디로 가는지만.
 *
 * 목록 표에서는 저장소 이름을 그대로 쓰지 않는다. 계정이 늘 같아서
 * 'snail5039-code/' 가 줄마다 반복되고, 그만큼 표가 옆으로 늘어난다.
 * 저장소 이름은 상세 화면 사양표에서 본다.
 */
export function repoHost(url: string): string {
  const host = url
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return host === "github.com" ? "GitHub" : host;
}
