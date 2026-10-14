/**
 * User-Agent 를 이름표 하나로 줄인다.
 *
 * 방문 집계(/api/visit)와 요청 집계(proxy.ts)가 같이 쓴다. 판정이 두 벌이면
 * 홈의 방문자 수와 관리자 화면의 사람/봇 구분이 서로 어긋난다.
 *
 * 원문은 어디에도 저장하지 않는다. UA 전문은 기기·OS 버전까지 들어 있어
 * 사람을 좁히는 데 쓸 수 있는 값이고, 알고 싶은 건 "봇이냐 사람이냐" 뿐이다.
 * (supabase/migrations/20260918000002_site_hits.sql)
 */

export type Agent = {
  isBot: boolean;
  /** 표에 찍히는 이름표. 40자를 넘지 않는다 (record_hit 이 자른다). */
  label: string;
};

/**
 * 이름을 밝히는 것들. 위에서부터 먼저 걸린 것을 쓴다.
 *
 * 검색엔진·소셜 미리보기·AI 크롤러·계측 도구를 나눠 적지 않고 한 줄로 둔다.
 * 어차피 화면에서는 이름 그대로 보여주고, 분류는 보는 사람이 한다.
 */
const NAMED_BOTS: [RegExp, string][] = [
  [/googlebot|google-inspectiontool|mediapartners-google/i, "googlebot"],
  [/bingbot|adidxbot/i, "bingbot"],
  [/yeti/i, "naver"],
  [/daum/i, "daum"],
  [/duckduckbot/i, "duckduckbot"],
  [/yandex/i, "yandexbot"],
  [/baiduspider/i, "baiduspider"],
  [/applebot/i, "applebot"],
  [/petalbot/i, "petalbot"],
  [/ahrefsbot/i, "ahrefsbot"],
  [/semrushbot/i, "semrushbot"],
  [/mj12bot/i, "mj12bot"],
  [/dotbot/i, "dotbot"],
  [/bytespider/i, "bytespider"],
  [/amazonbot/i, "amazonbot"],
  // AI 학습·검색 크롤러. 요즘 제일 많이 들어오는 쪽이라 따로 이름을 남긴다.
  [/gptbot|oai-searchbot|chatgpt-user/i, "gptbot"],
  [/claudebot|anthropic-ai|claude-web/i, "claudebot"],
  [/perplexitybot/i, "perplexitybot"],
  [/ccbot/i, "ccbot"],
  [/facebookexternalhit|facebookcatalog/i, "facebook"],
  [/twitterbot/i, "twitterbot"],
  [/slackbot|slack-imgproxy/i, "slackbot"],
  [/discordbot/i, "discordbot"],
  [/telegrambot/i, "telegrambot"],
  [/whatsapp/i, "whatsapp"],
  [/linkedinbot/i, "linkedinbot"],
  [/kakaotalk-scrap|kakaostory/i, "kakao"],
  [/embedly|quora link preview|skypeuripreview/i, "preview"],
  [/uptimerobot|pingdom|statuscake|betteruptime/i, "uptime"],
  [/lighthouse|pagespeed|chrome-lighthouse/i, "lighthouse"],
  [/vercel|netlify/i, "vercel"],
  [/curl|wget|libwww|httpie/i, "curl"],
  [/python-requests|aiohttp|scrapy|httpx/i, "python"],
  [/go-http-client/i, "go-http"],
  [/node-fetch|axios|undici|got /i, "node"],
  [/java\/|okhttp|apache-httpclient/i, "java"],
  [/headlesschrome|phantomjs|puppeteer|playwright|selenium/i, "headless"],
];

/** 이름을 안 밝혀도 이 단어가 있으면 사람이 아니다. */
const GENERIC_BOT = /bot\b|bot\/|crawl|spider|slurp|scrape|fetcher|monitor|probe|scan|http_request|feedfetcher|validator/i;

/** 사람이면 어느 브라우저로 왔는지까지만 본다. 순서가 중요하다 — 전부 Chrome 인 척한다. */
const BROWSERS: [RegExp, string][] = [
  [/whale/i, "whale"],
  [/edg[ea]?\//i, "edge"],
  [/opr\/|opera/i, "opera"],
  [/samsungbrowser/i, "samsung"],
  [/firefox|fxios/i, "firefox"],
  [/chrome|crios|chromium/i, "chrome"],
  // Safari 는 위 어느 것도 아닐 때만. Chrome 도 UA 에 Safari 를 달고 다닌다.
  [/safari/i, "safari"],
];

export function classifyAgent(ua: string | null | undefined): Agent {
  const s = (ua ?? "").trim();

  // UA 가 아예 없는 요청은 브라우저가 아니다. 사람으로 세면 숫자가 부푼다.
  if (!s) return { isBot: true, label: "무명" };

  for (const [re, label] of NAMED_BOTS) {
    if (re.test(s)) return { isBot: true, label };
  }
  if (GENERIC_BOT.test(s)) return { isBot: true, label: "기타 봇" };

  for (const [re, label] of BROWSERS) {
    if (re.test(s)) return { isBot: false, label };
  }

  // 브라우저로 보이지도 봇으로 보이지도 않는다. 사람 쪽에 두되 이름을 남겨
  // 나중에 목록에 더할지 판단할 수 있게 한다.
  return { isBot: false, label: "기타" };
}

/** 사람인가. 방문자 수를 셀 때는 이것만 본다. */
export function isBotAgent(ua: string | null | undefined): boolean {
  return classifyAgent(ua).isBot;
}
