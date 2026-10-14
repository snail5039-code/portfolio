/**
 * 어디를 거쳐 들어왔는지를 이름표 하나로 줄인다.
 *
 * 프록시(proxy.ts)가 페이지 요청마다 부른다. 판정 재료는 두 가지다 —
 * 브라우저가 보낸 `Referer` 헤더, 그리고 주소에 붙은 `utm_*` 값.
 *
 * 왜 필요한가
 *   방문자 수만으로는 "왔다"까지만 안다. 검색으로 찾아온 사람과 내가 노션에
 *   걸어 둔 링크를 타고 온 사람은 뜻이 다르다 — 앞은 사이트가 스스로 발견되는
 *   중이라는 뜻이고, 뒤는 내가 뿌린 링크가 도는 중이라는 뜻이다.
 *
 * 남기는 것과 남기지 않는 것
 *   도메인을 이름표로 줄이고(google·notion·github), 검색엔진이 넘겨준
 *   검색어만 따로 담는다. 경로(path)는 버린다 — 어느 글에서 왔는지까지
 *   쌓기 시작하면 링크 하나로 사람을 좁힐 수 있게 된다.
 *   IP 도 UA 원문도 여전히 저장하지 않는다. (docs/DESIGN.md 7장 "숫자는 진짜만")
 *
 * 알려진 한계 — 화면에도 같은 말을 적어 둔다
 *   · 구글·깃헙은 주소를 다 넘기지 않는다. 출처가 구글인 건 알아도
 *     무엇을 검색했는지는 모른다. 그건 서치 콘솔에서 봐야 한다.
 *   · 노션·카카오톡·인스타그램 앱처럼 Referer 를 아예 안 보내는 곳이 있다.
 *     그런 곳에서 온 사람은 "직접"으로 들어온다. 링크에 ?utm_source=notion 을
 *     붙여 두면 그때는 제대로 잡힌다.
 */

export type ReferrerKind =
  /** 검색엔진 결과에서 눌렀다 */
  | "search"
  /** AI 답변에 달린 링크에서 왔다 */
  | "ai"
  /** 내가 글·코드를 올려 두는 곳 — 노션·깃헙 */
  | "mine"
  /** 소셜·커뮤니티·블로그 */
  | "social"
  /** 그 밖의 외부 사이트 */
  | "link"
  /** 주소창에 직접 쳤거나, 출처를 안 보내는 곳에서 왔다 */
  | "direct";

export type Referrer = {
  kind: ReferrerKind;
  /** 표에 찍히는 이름표. 40자를 넘지 않는다 (record_hit 이 자른다). */
  source: string;
  /** 검색엔진이 넘겨준 검색어. 없으면 빈 문자열 — null 은 기본키에 못 쓴다. */
  term: string;
};

/**
 * 도메인 → [갈래, 이름표]. 위에서부터 먼저 걸린 것을 쓴다.
 *
 * 순서가 중요하다. 한 회사가 여러 갈래에 걸쳐 있다 — gemini.google.com 은
 * 검색이 아니라 AI 고, blog.naver.com 은 검색이 아니라 블로그다.
 * 좁은 것을 위에, 도메인 전체를 아래에 둔다.
 */
const SOURCES: [RegExp, ReferrerKind, string][] = [
  // ── AI. 구글·MS 도메인 아래 있어서 검색보다 먼저 본다 ──
  [/^chatgpt\.com$|^chat\.openai\.com$/, "ai", "chatgpt"],
  [/^gemini\.google\.com$|^bard\.google\.com$/, "ai", "gemini"],
  [/^copilot\.microsoft\.com$|^copilot\.cloud\.microsoft$/, "ai", "copilot"],
  [/(^|\.)perplexity\.ai$/, "ai", "perplexity"],
  [/(^|\.)claude\.ai$/, "ai", "claude"],
  [/(^|\.)you\.com$|(^|\.)phind\.com$|(^|\.)poe\.com$/, "ai", "ai 기타"],
  [/(^|\.)wrtn\.ai$|(^|\.)wrtn\.io$/, "ai", "뤼튼"],

  // ── 내가 올려 두는 곳 ──
  [/(^|\.)notion\.so$|(^|\.)notion\.site$|(^|\.)notion\.com$/, "mine", "notion"],
  [/(^|\.)github\.com$|(^|\.)github\.io$/, "mine", "github"],

  // ── 검색 ──
  // 네이버는 좁은 것부터. 검색·블로그·카페가 한 도메인 아래 있다.
  [/^(m\.)?search\.naver\.com$/, "search", "naver"],
  [/^(blog|cafe|post|in|m)\.naver\.com$/, "social", "naver"],
  [/^search\.daum\.net$/, "search", "daum"],
  [/^(cafe|blog)\.daum\.net$/, "social", "daum"],
  [/^search\.zum\.com$|^search\.nate\.com$/, "search", "zum·nate"],
  [/(^|\.)google\.[a-z.]+$/, "search", "google"],
  [/(^|\.)bing\.com$/, "search", "bing"],
  [/(^|\.)duckduckgo\.com$/, "search", "duckduckgo"],
  [/^search\.brave\.com$/, "search", "brave"],
  [/(^|\.)ecosia\.org$/, "search", "ecosia"],
  [/(^|\.)startpage\.com$|(^|\.)qwant\.com$|(^|\.)mojeek\.com$|(^|\.)kagi\.com$/, "search", "검색 기타"],
  [/(^|\.)yandex\.[a-z.]+$/, "search", "yandex"],
  [/(^|\.)baidu\.com$/, "search", "baidu"],
  [/(^|\.)yahoo\.[a-z.]+$/, "search", "yahoo"],

  // ── 소셜·커뮤니티·블로그 ──
  [/(^|\.)x\.com$|(^|\.)twitter\.com$|^t\.co$/, "social", "x"],
  [/(^|\.)facebook\.com$|^fb\.me$|^l\.facebook\.com$/, "social", "facebook"],
  [/(^|\.)instagram\.com$/, "social", "instagram"],
  [/(^|\.)threads\.(net|com)$/, "social", "threads"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "social", "linkedin"],
  [/(^|\.)reddit\.com$|^redd\.it$/, "social", "reddit"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "social", "youtube"],
  [/(^|\.)discord\.com$|^discord\.gg$/, "social", "discord"],
  [/^t\.me$|(^|\.)telegram\.org$/, "social", "telegram"],
  [/(^|\.)kakao\.com$|(^|\.)daum\.net$/, "social", "kakao"],
  [/^band\.us$/, "social", "band"],
  [/(^|\.)tistory\.com$/, "social", "tistory"],
  [/(^|\.)velog\.io$/, "social", "velog"],
  [/(^|\.)brunch\.co\.kr$/, "social", "brunch"],
  [/(^|\.)medium\.com$/, "social", "medium"],
  [/(^|\.)dev\.to$|(^|\.)hashnode\.(dev|com)$/, "social", "dev.to"],
  [/^news\.ycombinator\.com$/, "social", "hn"],
  [/(^|\.)okky\.kr$|(^|\.)holaworld\.io$/, "social", "okky"],
  [/(^|\.)clien\.net$/, "social", "clien"],
  [/(^|\.)dcinside\.com$/, "social", "dcinside"],
  [/(^|\.)fmkorea\.com$/, "social", "fmkorea"],
  [/(^|\.)ruliweb\.com$/, "social", "ruliweb"],
  [/(^|\.)ppomppu\.co\.kr$/, "social", "ppomppu"],
  [/(^|\.)theqoo\.net$|(^|\.)inven\.co\.kr$|(^|\.)bobaedream\.co\.kr$/, "social", "커뮤니티"],
];

/** 검색엔진이 검색어를 담아 보내는 이름들. 먼저 걸린 것을 쓴다. */
const TERM_KEYS = ["query", "q", "wd", "text", "p", "keyword", "search_query"];

/** utm_medium → 갈래. 링크에 손수 붙인 값이라 곧이곧대로 받는다. */
const UTM_KINDS: Record<string, ReferrerKind> = {
  search: "search",
  organic: "search",
  ai: "ai",
  social: "social",
  sns: "social",
  referral: "link",
  link: "link",
};

/**
 * 요청 하나를 유입 한 건으로 줄인다.
 *
 * `null` 을 돌려주면 세지 않는다는 뜻이다 — 사이트 안에서 옮겨 다닌 것은
 * 유입이 아니다. 그걸 세면 여러 쪽을 본 사람 하나가 열 번 들어온 것처럼 보인다.
 *
 * @param referer  Referer 헤더 원문
 * @param url      지금 요청된 주소. utm 값과 내부 이동 판정에 쓴다
 */
export function classifyReferrer(
  referer: string | null | undefined,
  url: URL,
): Referrer | null {
  // utm 이 붙어 있으면 그게 먼저다. Referer 를 안 보내는 곳(노션·카카오톡·
  // 인스타그램 앱)을 잡으려고 내가 손수 붙인 값이라, 헤더보다 뜻이 분명하다.
  const utm = trim(url.searchParams.get("utm_source"), 40);
  if (utm) {
    const medium = (url.searchParams.get("utm_medium") ?? "").toLowerCase();
    // utm_source=notion 처럼 아는 이름을 적었으면 갈래도 그쪽을 따른다.
    // 링크마다 utm_medium 을 빠짐없이 적을 자신이 없어서 두 겹으로 둔다.
    const known = SOURCES.find(([, , source]) => source === utm.toLowerCase());
    return {
      kind: UTM_KINDS[medium] ?? known?.[1] ?? "link",
      source: known?.[2] ?? utm.toLowerCase(),
      term: trim(url.searchParams.get("utm_term"), 60).toLowerCase(),
    };
  }

  const from = parse(referer);

  // 헤더가 없거나 읽을 수 없는 꼴이다. 주소창에 직접 친 사람과, 출처를
  // 숨기는 곳에서 온 사람이 여기 섞인다. 둘을 가를 방법은 없다.
  if (!from) return { kind: "direct", source: "직접", term: "" };

  // 내 사이트 안에서의 이동. 도메인이 여럿이어도 (localhost·미리보기 배포)
  // 지금 요청된 호스트와 비교하므로 따로 적어 둘 목록이 없다.
  if (from.host === url.host) return null;

  const host = from.host.replace(/^www\./, "");

  for (const [re, kind, source] of SOURCES) {
    if (!re.test(host)) continue;
    return { kind, source, term: kind === "search" ? searchTerm(from) : "" };
  }

  // 모르는 곳. 도메인을 그대로 이름표로 쓴다 — 목록에 더할지는
  // 실제로 사람이 오는 걸 보고 정한다.
  return { kind: "link", source: trim(host, 40) || "link", term: "" };
}

/** 검색엔진 주소에서 검색어만. 넘겨주지 않는 곳이 더 많다. */
function searchTerm(from: URL): string {
  for (const key of TERM_KEYS) {
    const value = trim(from.searchParams.get(key), 60);
    // 검색어가 60자를 넘는 일은 거의 없다. 그만큼 길면 검색어가 아니라
    // 주소나 토큰이 들어온 것이니 버린다.
    if (value) return value.toLowerCase();
  }
  return "";
}

function parse(referer: string | null | undefined): URL | null {
  const s = (referer ?? "").trim();
  if (!s) return null;
  try {
    const url = new URL(s);
    // http(s) 만 본다. android-app:// 같은 것도 들어오는데 호스트 뜻이 다르다.
    return /^https?:$/.test(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/** 공백을 줄이고 길이를 자른다. 표 한 칸에 들어가야 한다. */
function trim(value: string | null | undefined, max: number): string {
  const s = (value ?? "").replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) : s;
}

/** 화면에 찍는 갈래 이름. 관리자 화면 한 곳에서만 쓴다. */
export const KIND_LABELS: Record<ReferrerKind, string> = {
  search: "검색",
  ai: "AI 답변",
  mine: "노션 · 깃헙",
  social: "소셜 · 커뮤니티",
  link: "다른 사이트",
  direct: "직접",
};
