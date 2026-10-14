import { defaultLocale, fallbackLocale } from "@/i18n/routing";

/**
 * 스튜디오가 직접 관리하는 내용. DB에 둘 만큼 자주 바뀌지 않는다.
 * 소개 화면의 "지금 만들고 있는 것"에 쓴다.
 *
 * 화면 문구(messages/*.json)와 달리 10개 언어를 다 채우지 않는다.
 * 제품 설명과 같은 규칙을 쓴다 — ko와 en만 필수, 나머지는 en으로 폴백한다.
 * (docs/ARCHITECTURE.md "다국어")
 */

type Text = { ko: string; en: string } & Partial<Record<string, string>>;

const WIP_SOURCE: { name: Text; note: Text }[] = [
  {
    name: { ko: "클립보드 기록 관리 도구", en: "Clipboard history manager" },
    note: { ko: "10월 예정", en: "Planned for October" },
  },
  {
    name: { ko: "macOS 빌드", en: "macOS build" },
    note: { ko: "검토 중", en: "Looking into it" },
  },
  {
    name: { ko: "라이선스 키 발급", en: "License key issuing" },
    note: { ko: "보류", en: "On hold" },
  },
];

function pick(text: Text, locale: string): string {
  const v = text[locale];
  if (v && v.trim()) return v;
  return text[fallbackLocale]?.trim() ? text[fallbackLocale]! : text[defaultLocale];
}

export function getWip(locale: string) {
  return WIP_SOURCE.map((w) => ({
    name: pick(w.name, locale),
    note: pick(w.note, locale),
  }));
}
