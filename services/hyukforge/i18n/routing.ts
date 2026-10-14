import { defineRouting } from "next-intl/routing";

/**
 * 지원 언어. 순서가 언어 선택 메뉴에 그대로 노출된다.
 *
 * ko가 기본이고 en이 폴백이다 (i18n/request.ts 참고).
 * 언어를 추가하려면 여기와 messages/ 에 파일을 같이 추가한다.
 */
export const locales = [
  "ko",
  "en",
  "ja",
  "zh-CN",
  "zh-TW",
  "es",
  "pt-BR",
  "de",
  "fr",
  "ru",
] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale = "ko" satisfies AppLocale;

/** 폴백 기준 언어. ko에 없고 en에 있으면 en을 쓴다. */
export const fallbackLocale = "en" satisfies AppLocale;

/** 언어 선택 메뉴에 띄울 이름. 각 언어는 자기 표기법으로 적는다. */
export const localeNames: Record<AppLocale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文",
  es: "Español",
  "pt-BR": "Português",
  de: "Deutsch",
  fr: "Français",
  ru: "Русский",
};

export const routing = defineRouting({
  locales,
  defaultLocale,

  // 기본 언어에도 접두사를 붙인다 (/ko/products).
  // 링크 공유와 hreflang이 단순해지고, 루트 경로에 콘텐츠가 중복되지 않는다.
  localePrefix: "always",

  // 첫 방문은 Accept-Language로 추정하고, 이후에는 쿠키를 따른다.
  localeDetection: true,
});
