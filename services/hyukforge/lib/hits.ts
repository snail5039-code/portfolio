import { classifyAgent } from "./visitors";
import { classifyReferrer } from "./referrers";

/**
 * 페이지 요청 한 건을 기록한다. 사람과 봇을 갈라 날짜별로 쌓고,
 * 사람이면 어디를 거쳐 들어왔는지도 같이 남긴다 (lib/referrers.ts).
 *
 * 프록시(proxy.ts)에서 부른다 — 봇은 자바스크립트를 돌리지 않아
 * 브라우저가 알리는 /api/visit 에 영영 잡히지 않기 때문이다.
 * 서버가 받은 자리에서 세야 "오늘 온 것 중 몇이 크롤러였나"를 알 수 있다.
 *
 * 응답을 기다리지 않는다. 부르는 쪽이 next/server 의 after() 로 감싸서
 * 응답이 나간 뒤에 돌린다 — 통계 때문에 화면이 늦어지면 안 된다.
 */

/**
 * 요청마다 로그를 찍으면 로그가 못 쓰게 된다. 같은 이유는 한 번만 알린다.
 *
 * 특히 마이그레이션을 아직 안 올렸을 때가 그렇다 — record_hit() 이 없어
 * 모든 페이지 요청이 404 를 하나씩 남긴다. 그걸 다 찍으면 정작 봐야 할
 * 오류가 묻힌다.
 */
const warned = new Set<string>();

function warnOnce(key: string, ...message: unknown[]) {
  if (warned.has(key)) return;
  warned.add(key);
  console.error(...message);
}

/**
 * @param userAgent UA 헤더 원문
 * @param referer   Referer 헤더 원문
 * @param href      지금 요청된 주소. utm 값과 내부 이동 판정에 쓴다
 */
export async function recordHit(
  userAgent: string | null,
  referer: string | null,
  href: string,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    warnOnce("key", "[hit] 서버 키가 없어 요청 집계를 건너뜁니다");
    return;
  }

  const { isBot, label } = classifyAgent(userAgent);

  // 봇의 Referer 는 자기가 적어 넣은 값이라 뜻이 없다. 사람일 때만 본다.
  // null 이면 사이트 안에서 옮겨 다닌 것 — 유입으로 세지 않는다.
  const from = isBot ? null : safeClassify(referer, href);

  try {
    const res = await fetch(`${url}/rest/v1/rpc/record_hit`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_is_bot: isBot,
        p_agent: label,
        p_kind: from?.kind ?? null,
        p_source: from?.source ?? null,
        p_term: from?.term ?? null,
      }),
    });

    if (!res.ok) {
      warnOnce(`http:${res.status}`, "[hit] 기록 실패", res.status, await res.text());
    }
  } catch (error) {
    // 집계가 실패해도 방문자에게 보일 일은 없다. 응답은 이미 나갔다.
    warnOnce("throw", "[hit] 기록 실패", error);
  }
}

/**
 * 주소가 깨져 있어도 요청 집계까지 같이 놓치지는 않는다.
 * 유입 경로는 부가 정보고, 사람/봇 숫자가 더 중요하다.
 */
function safeClassify(referer: string | null, href: string) {
  try {
    return classifyReferrer(referer, new URL(href));
  } catch (error) {
    warnOnce("referrer", "[hit] 유입 경로 판정 실패", error);
    return null;
  }
}

/**
 * 셀 만한 요청인가.
 *
 *  · 관리자 화면과 목업(/preview)은 내가 보는 것이다. 세면 숫자가 거짓이 된다.
 *  · 개발 중인 화면도 마찬가지다 (아래 isLocalHost).
 *  · 문서 요청만 센다. Next 는 화면 안에서 옮겨 다닐 때 RSC 요청을 따로 보내고
 *    링크에 마우스만 올려도 미리 받아온다. 그걸 다 세면 사람 쪽만 몇 배로 부푼다.
 *    봇은 sec-fetch-dest 를 보내지 않으므로 헤더가 없으면 통과시킨다.
 */
export function countableHit(
  pathname: string,
  secFetchDest: string | null,
  hostname: string,
): boolean {
  if (isLocalHost(hostname)) return false;
  if (/\/(admin|preview)(\/|$)/.test(pathname)) return false;
  if (secFetchDest && secFetchDest !== "document") return false;
  return true;
}

/**
 * 내 컴퓨터에서 보고 있는 중인가.
 *
 * 로컬 개발 서버도 프로덕션 DB 를 가리킨다. 그래서 화면 하나 고치는 동안
 * "직접" 유입과 방문자가 실제 통계에 쌓였다. 관리자 화면과 목업을 빼는 것과
 * 같은 이유로 뺀다 — 내가 보는 것은 방문이 아니다.
 *
 * 사설 IP 도 로컬로 본다. 폰으로 확인할 때 192.168.x.x 로 들어오는데,
 * 그것도 내가 보는 것이다. 배포 환경은 어차피 여기 걸릴 일이 없다.
 *
 * 판정은 여기 한 곳에서만 한다. 프록시(site_hits)와 /api/visit(site_visits)가
 * 같이 쓴다 — 두 벌이면 한쪽만 세어져서 표끼리 어긋난다.
 */
export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local")) return true;
  if (h === "::1" || h === "0.0.0.0") return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h)) return true;
  return /^172\.(1[6-9]|2\d|3[01])\./.test(h);
}
