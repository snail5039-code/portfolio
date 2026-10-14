/**
 * User-Agent 판정이 맞는지 본다.
 *
 * 이 판정 하나에 홈의 방문자 수와 관리자 화면의 사람/봇 구분이 같이 걸려 있다.
 * 정규식을 손볼 일이 계속 생기는데(새 크롤러가 나온다), 순서를 한 줄 잘못 넣으면
 * Chrome 이 봇으로 빠지거나 봇이 사람으로 세어진다. 둘 다 조용히 틀린다.
 *
 * Safari 검사가 특히 그렇다 — Chrome·Edge·Whale 이 전부 UA 에 Safari 를 달고 다녀서
 * 순서가 바뀌면 사람 통계가 통째로 safari 로 쏠린다.
 *
 *   node scripts/test-agents.mjs
 */

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const { classifyAgent } = await import(
  pathToFileURL(resolve(process.cwd(), "lib/visitors.ts")).href
);

/** [UA, 봇인가, 이름표] */
const CASES = [
  // 사람 — 전부 Safari 를 달고 다닌다. 순서가 뒤집히면 여기서 걸린다
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36", false, "chrome"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0", false, "edge"],
  ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", false, "safari"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0", false, "firefox"],
  ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Whale/4.0.0.0 Safari/537.36", false, "whale"],
  ["Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36", false, "samsung"],

  // 봇 — 이름을 밝히는 것들
  ["Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", true, "googlebot"],
  ["Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", true, "bingbot"],
  ["Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)", true, "naver"],
  ["Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot", true, "gptbot"],
  ["Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)", true, "claudebot"],
  ["facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", true, "facebook"],
  ["curl/8.4.0", true, "curl"],
  ["python-requests/2.32.3", true, "python"],
  ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36", true, "headless"],

  // 이름을 안 밝혀도 걸러야 하는 것들
  ["Mozilla/5.0 (compatible; SomeUnknownBot/1.0; +http://example.com)", true, "기타 봇"],
  ["", true, "무명"],
  [null, true, "무명"],
];

let failed = 0;

for (const [ua, isBot, label] of CASES) {
  const got = classifyAgent(ua);
  const pass = got.isBot === isBot && got.label === label;
  if (!pass) failed++;

  console.log(
    `  ${pass ? "✓" : "✗"} ${label.padEnd(9)} ${pass ? "" : `→ ${got.isBot ? "봇" : "사람"} / ${got.label}  `}${String(ua).slice(0, 52)}`,
  );
}

console.log(failed ? `\n${failed}건 실패` : `\n${CASES.length}건 전부 통과`);
process.exit(failed ? 1 : 0);
