import type { Stats } from "./products";

/**
 * DB 조회가 실패해도 화면 전체가 죽지 않게 한다.
 *
 * 왜 필요한가
 *  · Supabase 무료 프로젝트는 일정 기간 쓰지 않으면 일시정지된다
 *  · 마이그레이션이 아직 안 올라간 상태로 배포될 수 있다
 *  · 어느 쪽이든 소개 글과 네비게이션까지 같이 죽을 이유는 없다
 *
 * 조회 함수 자체는 그대로 throw 한다. 오류를 삼키는 건 화면 쪽 결정이다.
 * 서버 로그에는 남기므로 조용히 묻히지 않는다.
 */
export function orEmpty<T>(fallback: T, label: string) {
  return (error: unknown): T => {
    console.error(`[query:${label}] 조회 실패 — 빈 값으로 렌더합니다`, error);
    return fallback;
  };
}

/**
 * 검색어를 ilike 패턴에 넣어도 안전한 꼴로 바꾼다.
 *
 * 두 가지를 막는다.
 *   · `%` `_` — LIKE 의 와일드카드다. 그대로 두면 "100%" 검색이 전부와 맞는다.
 *   · `,` `(` `)` `"` — PostgREST 가 or 필터를 쪼갤 때 쓰는 문자다.
 *     값에 섞이면 필터 구문 자체가 어긋난다.
 *
 * 게시판 검색과 전체 검색이 같은 규칙을 써야 해서 여기 둔다.
 * 한쪽만 고치면 같은 검색어가 화면마다 다르게 동작한다.
 */
export function likeSafe(term: string): string {
  return term
    // 백슬래시가 ilike 의 기본 이스케이프 문자다. 그래서 자기 자신도 먼저 escape 한다.
    .replace(/[\\%_]/g, (m) => "\\" + m)
    .replace(/[(),"]/g, " ")
    .trim();
}

/**
 * `a.ilike.%검색어%,b.ilike.%검색어%` 형태의 or 필터를 만든다.
 * 검색어는 이미 likeSafe 를 거친 값이어야 한다.
 */
export function ilikeAny(columns: string[], term: string): string {
  return columns.map((c) => `${c}.ilike.%${term}%`).join(",");
}

export const EMPTY_STATS: Stats = {
  productCount: 0,
  monthlyDownloads: 0,
  totalDownloads: 0,
  lastUpdated: null,
};
