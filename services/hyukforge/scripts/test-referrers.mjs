/**
 * 유입 경로 판정이 맞는지 본다.
 *
 * 정규식 순서 하나에 화면의 뜻이 통째로 달려 있다. 한 회사가 여러 갈래에
 * 걸쳐 있어서 그렇다 — gemini.google.com 은 검색이 아니라 AI 고,
 * blog.naver.com 은 검색이 아니라 블로그다. 좁은 규칙을 아래로 내리면
 * "검색으로 들어왔다"가 조용히 부풀고, 그걸 보고 글을 더 쓰게 된다.
 *
 * 내부 이동(null)도 여기서 지킨다. 그게 새면 여러 쪽을 본 사람 하나가
 * 열 번 들어온 것처럼 보인다.
 *
 *   node scripts/test-referrers.mjs
 */

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { classifyReferrer } = await import(
  pathToFileURL(resolve(process.cwd(), "lib/referrers.ts")).href
);

const HERE = "https://hyukforge.com/ko";

/** [Referer, 들어온 주소, 기대값 — null 이면 세지 않는다] */
const CASES = [
  // ── 검색. 검색어를 넘겨주는 곳과 아닌 곳 ──
  [
    "https://search.naver.com/search.naver?where=nexearch&query=%EA%B7%BC%ED%83%9C%20%EA%B4%80%EB%A6%AC%20%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%A8",
    HERE,
    { kind: "search", source: "naver", term: "근태 관리 프로그램" },
  ],
  [
    "https://search.daum.net/search?w=tot&q=hyukforge",
    HERE,
    { kind: "search", source: "daum", term: "hyukforge" },
  ],
  [
    "https://www.bing.com/search?q=Commute+Log",
    HERE,
    { kind: "search", source: "bing", term: "commute log" },
  ],
  // 구글은 주소를 다 넘기지 않는다. 출처까지만 아는 게 정상이다
  ["https://www.google.com/", HERE, { kind: "search", source: "google", term: "" }],
  ["https://www.google.co.kr/", HERE, { kind: "search", source: "google", term: "" }],

  // ── AI. 구글·MS 도메인 아래 있어서 검색 규칙보다 먼저 걸려야 한다 ──
  ["https://gemini.google.com/app", HERE, { kind: "ai", source: "gemini", term: "" }],
  ["https://chatgpt.com/c/abc", HERE, { kind: "ai", source: "chatgpt", term: "" }],
  ["https://www.perplexity.ai/search/x", HERE, { kind: "ai", source: "perplexity", term: "" }],
  ["https://claude.ai/chat/abc", HERE, { kind: "ai", source: "claude", term: "" }],

  // ── 내가 올려 두는 곳 ──
  ["https://www.notion.so/abc123", HERE, { kind: "mine", source: "notion", term: "" }],
  ["https://hyuk.notion.site/page", HERE, { kind: "mine", source: "notion", term: "" }],
  ["https://github.com/snail5039-code/lastcall", HERE, { kind: "mine", source: "github", term: "" }],

  // ── 네이버 한 도메인 안에서 갈래가 갈린다 ──
  ["https://blog.naver.com/someone/123", HERE, { kind: "social", source: "naver", term: "" }],
  ["https://cafe.naver.com/board/1", HERE, { kind: "social", source: "naver", term: "" }],

  // ── 소셜 ──
  ["https://x.com/someone/status/1", HERE, { kind: "social", source: "x", term: "" }],
  ["https://t.co/abcd", HERE, { kind: "social", source: "x", term: "" }],
  ["https://news.ycombinator.com/item?id=1", HERE, { kind: "social", source: "hn", term: "" }],

  // ── 모르는 곳은 도메인 그대로. www 는 뗀다 ──
  ["https://www.example.com/post/1", HERE, { kind: "link", source: "example.com", term: "" }],

  // ── 출처가 없다 ──
  [null, HERE, { kind: "direct", source: "직접", term: "" }],
  ["", HERE, { kind: "direct", source: "직접", term: "" }],
  // http(s) 가 아닌 것도 출처로 치지 않는다 — 호스트의 뜻이 다르다
  ["android-app://com.google.android.gm", HERE, { kind: "direct", source: "직접", term: "" }],
  ["엉망인 값", HERE, { kind: "direct", source: "직접", term: "" }],

  // ── 사이트 안에서의 이동은 유입이 아니다 ──
  ["https://hyukforge.com/ko/products", HERE, null],
  ["http://localhost:3000/ko", "http://localhost:3000/ko/products", null],

  // ── utm 은 헤더보다 먼저다. Referer 를 안 보내는 곳을 잡으려고 붙이는 값 ──
  [
    null,
    "https://hyukforge.com/ko?utm_source=notion",
    { kind: "mine", source: "notion", term: "" },
  ],
  [
    // 출처를 숨기는 곳에서 왔어도 utm 이 있으면 그걸 믿는다
    "https://www.google.com/",
    "https://hyukforge.com/ko?utm_source=letter&utm_medium=social",
    { kind: "social", source: "letter", term: "" },
  ],
];

let failed = 0;

for (const [referer, href, want] of CASES) {
  const got = classifyReferrer(referer, new URL(href));

  const pass =
    want === null
      ? got === null
      : got !== null &&
        got.kind === want.kind &&
        got.source === want.source &&
        got.term === want.term;

  if (!pass) failed++;

  const shown = want === null ? "세지 않음" : `${want.kind}/${want.source}`;
  const actual = got === null ? "세지 않음" : `${got.kind}/${got.source}/${got.term}`;

  console.log(
    `  ${pass ? "✓" : "✗"} ${shown.padEnd(16)} ${pass ? "" : `→ ${actual}  `}${String(referer).slice(0, 48)}`,
  );
}

console.log(failed ? `\n${failed}건 실패` : `\n${CASES.length}건 전부 통과`);
process.exit(failed ? 1 : 0);
