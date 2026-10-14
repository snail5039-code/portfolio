import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, fallbackLocale, routing } from "./routing";

type Messages = { [key: string]: string | Messages };

/**
 * 뒤 객체가 앞 객체를 덮되, 비어 있는 값은 덮지 않는다.
 * 번역이 아직 안 된 키를 빈 문자열로 남겨둬도 폴백이 살아 있게 하려는 것.
 */
function overlay(base: Messages, patch: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === "string") {
      if (value.trim() !== "") out[key] = value;
    } else if (value && typeof value === "object") {
      const prev = out[key];
      out[key] = overlay(
        prev && typeof prev === "object" ? prev : {},
        value as Messages,
      );
    }
  }
  return out;
}

async function load(locale: string): Promise<Messages> {
  try {
    return (await import(`../messages/${locale}.json`)).default as Messages;
  } catch {
    // 파일이 아직 없는 언어는 폴백에 맡긴다
    return {};
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : defaultLocale;

  // 폴백 순서: 요청 언어 → en → ko (앞이 우선)
  // overlay는 뒤가 앞을 덮으므로 우선순위를 뒤집어 겹친다.
  // 같은 언어가 두 번 나오면 뒤쪽만 남긴다 — 그래야 ko 페이지에서
  // en이 ko를 덮어쓰는 일이 없다.
  const chain = [defaultLocale, fallbackLocale, locale].filter(
    (l, i, arr) => arr.lastIndexOf(l) === i,
  );

  const loaded = await Promise.all(chain.map(load));

  return {
    locale,
    messages: loaded.reduce<Messages>((acc, m) => overlay(acc, m), {}),
    // 서버·클라이언트 시간대가 달라 발생하는 하이드레이션 불일치를 막는다
    timeZone: "Asia/Seoul",
  };
});
