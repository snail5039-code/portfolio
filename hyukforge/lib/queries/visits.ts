import { createClient } from "@/lib/supabase/server";
import { kstDay } from "@/lib/format";
import type { ReferrerKind } from "@/lib/referrers";

/**
 * 방문 통계의 관리자용 조회.
 *
 * 세 테이블을 같이 읽는다. 뜻이 다르니 한 칸에 섞지 않는다.
 *   site_visits    — 그날 처음 온 사람 (쿠키 기준). 홈에 걸리는 값이다
 *   site_hits      — 서버가 받은 페이지 요청 (사람·봇 각각). 프록시가 쌓는다
 *   site_referrers — 그 요청 중 사람 것이 어디를 거쳐 왔는지
 *
 * 전부 RLS 로 관리자에게만 열려 있다. anon 은 0행을 본다
 * (supabase/migrations/20260918000002_site_hits.sql · 20260922000001_site_referrers.sql).
 */

export type VisitDay = {
  /** 2026-09-18 (KST) */
  day: string;
  /** 그날 처음 온 사람. 세지 못한 날은 null 이 아니라 0 이다 */
  visitors: number;
  /** 브라우저가 알린 열어본 횟수 */
  views: number;
  /** 서버가 받은 페이지 요청 — 사람 */
  human: number;
  /** 서버가 받은 페이지 요청 — 봇 */
  bot: number;
};

export type AgentTotal = {
  agent: string;
  isBot: boolean;
  hits: number;
};

/** 갈래별 합계. 검색으로 왔나, 내 링크로 왔나 — 제일 먼저 보는 값이다. */
export type KindTotal = {
  kind: ReferrerKind;
  hits: number;
};

/** 출처별 합계. google·notion 처럼 도메인을 줄인 이름표 단위다. */
export type SourceTotal = {
  kind: ReferrerKind;
  source: string;
  hits: number;
};

/** 검색어. 넘겨주는 검색엔진에서 온 것만 쌓인다. */
export type TermTotal = {
  source: string;
  term: string;
  hits: number;
};

export type VisitReport = {
  days: VisitDay[];
  bots: AgentTotal[];
  humans: AgentTotal[];
  /** 갈래별 유입. 많이 온 순 */
  kinds: KindTotal[];
  /** 출처별 유입. 많이 온 순 */
  sources: SourceTotal[];
  /** 검색어. 많이 온 순 */
  terms: TermTotal[];
  /** 기간 합계. referrals 는 유입으로 센 요청 수 — human 보다 작다(사이트 안 이동은 빠진다) */
  total: {
    visitors: number;
    views: number;
    human: number;
    bot: number;
    referrals: number;
  };
  /** 기록이 시작된 날. 없으면 null */
  since: string | null;
  /** 프록시 집계가 한 건도 없는가 — 마이그레이션을 아직 안 올렸을 때 그렇다 */
  noHits: boolean;
  /** 유입 기록이 한 건도 없는가 — 마이그레이션을 아직 안 올렸을 때 그렇다 */
  noReferrers: boolean;
};

type VisitRow = { day: string; views: number; visitors: number };
type HitRow = { day: string; is_bot: boolean; agent: string; hits: number };
type ReferrerRow = {
  day: string;
  kind: ReferrerKind;
  source: string;
  term: string;
  hits: number;
};

export async function getVisitReport(days = 30): Promise<VisitReport> {
  const supabase = await createClient();

  // 경계를 KST 로 자른다. UTC 로 자르면 오늘이 하루 일찍 잘린다 (lib/format.ts)
  const from = kstDay(new Date(Date.now() - (days - 1) * 86_400_000));

  const [visits, hits, referrers] = await Promise.all([
    supabase
      .from("site_visits")
      .select("day, views, visitors")
      .gte("day", from)
      .order("day", { ascending: false }),
    supabase
      .from("site_hits")
      .select("day, is_bot, agent, hits")
      .gte("day", from),
    supabase
      .from("site_referrers")
      .select("day, kind, source, term, hits")
      .gte("day", from),
  ]);

  // 42P01 = relation does not exist. 마이그레이션을 아직 안 올린 상태다.
  // 그것 때문에 화면이 통째로 죽으면 원인을 찾기가 더 어렵다 —
  // 빈 값으로 넘기고 화면이 "기록이 없다"고 말하게 둔다.
  if (visits.error && visits.error.code !== "42P01") throw visits.error;
  if (hits.error && hits.error.code !== "42P01") throw hits.error;
  if (referrers.error && referrers.error.code !== "42P01") throw referrers.error;

  const visitRows = (visits.data ?? []) as unknown as VisitRow[];
  const hitRows = (hits.data ?? []) as unknown as HitRow[];
  const refRows = (referrers.data ?? []) as unknown as ReferrerRow[];

  // 날짜별로 합친다. 어느 한쪽에만 있는 날도 있다 —
  // 봇만 들어온 날은 site_visits 에 행이 아예 생기지 않는다.
  const byDay = new Map<string, VisitDay>();
  const at = (day: string) => {
    let row = byDay.get(day);
    if (!row) {
      row = { day, visitors: 0, views: 0, human: 0, bot: 0 };
      byDay.set(day, row);
    }
    return row;
  };

  for (const v of visitRows) {
    const row = at(v.day);
    row.visitors = Number(v.visitors);
    row.views = Number(v.views);
  }
  for (const h of hitRows) {
    const row = at(h.day);
    if (h.is_bot) row.bot += Number(h.hits);
    else row.human += Number(h.hits);
  }

  const list = [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));

  // 이름표별 합계. 많이 온 순으로 — 어떤 크롤러가 사이트를 훑고 있는지가 먼저다.
  const agents = new Map<string, AgentTotal>();
  for (const h of hitRows) {
    const key = `${h.is_bot ? "b" : "h"}:${h.agent}`;
    const cur = agents.get(key) ?? { agent: h.agent, isBot: h.is_bot, hits: 0 };
    cur.hits += Number(h.hits);
    agents.set(key, cur);
  }
  const sorted = [...agents.values()].sort((a, b) => b.hits - a.hits);

  // 유입은 세 가지로 접는다. 같은 행을 갈래별·출처별·검색어별로 세는 것이라
  // 합계가 서로 맞아야 한다 — kinds 의 합 = sources 의 합 = referrals.
  const kinds = new Map<ReferrerKind, number>();
  const sources = new Map<string, SourceTotal>();
  const terms = new Map<string, TermTotal>();
  let referrals = 0;

  for (const r of refRows) {
    const n = Number(r.hits);
    referrals += n;

    kinds.set(r.kind, (kinds.get(r.kind) ?? 0) + n);

    const sKey = `${r.kind}:${r.source}`;
    const s = sources.get(sKey) ?? { kind: r.kind, source: r.source, hits: 0 };
    s.hits += n;
    sources.set(sKey, s);

    // 검색어를 안 넘겨주는 곳이 더 많다. 빈 값은 표에 올리지 않는다 —
    // "(없음)" 한 줄이 제일 큰 값으로 올라와 나머지를 덮는다.
    if (!r.term) continue;
    const tKey = `${r.source}:${r.term}`;
    const t = terms.get(tKey) ?? { source: r.source, term: r.term, hits: 0 };
    t.hits += n;
    terms.set(tKey, t);
  }

  return {
    days: list,
    bots: sorted.filter((a) => a.isBot),
    humans: sorted.filter((a) => !a.isBot),
    kinds: [...kinds]
      .map(([kind, hits]) => ({ kind, hits }))
      .sort((a, b) => b.hits - a.hits),
    sources: [...sources.values()].sort((a, b) => b.hits - a.hits),
    terms: [...terms.values()].sort((a, b) => b.hits - a.hits),
    total: {
      ...list.reduce(
        (acc, d) => ({
          visitors: acc.visitors + d.visitors,
          views: acc.views + d.views,
          human: acc.human + d.human,
          bot: acc.bot + d.bot,
        }),
        { visitors: 0, views: 0, human: 0, bot: 0 },
      ),
      referrals,
    },
    since: list.length ? list[list.length - 1].day : null,
    noHits: hitRows.length === 0,
    noReferrers: refRows.length === 0,
  };
}
