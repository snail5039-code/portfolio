import { defaultLocale, fallbackLocale } from "@/i18n/routing";

type Row = { locale: string } & Record<string, unknown>;

/**
 * DB 콘텐츠의 번역을 고른다. 화면 문구와 같은 순서를 쓴다.
 *
 *   요청 언어 → en → ko
 *
 * 값이 비어 있는 것도 없는 것으로 친다.
 * 관리자가 번역을 만들다 만 상태로 저장해도 화면이 비지 않게 하려는 것.
 * (i18n/request.ts의 화면 문구 폴백과 같은 규칙)
 */
export function pickTranslation<T extends Row>(
  rows: T[] | null | undefined,
  locale: string,
  requiredField: keyof T = "name" as keyof T,
): T | null {
  if (!rows?.length) return null;

  const usable = (row: T | undefined) => {
    if (!row) return null;
    const v = row[requiredField];
    return typeof v === "string" && v.trim() !== "" ? row : null;
  };

  for (const l of [locale, fallbackLocale, defaultLocale]) {
    const hit = usable(rows.find((r) => r.locale === l));
    if (hit) return hit;
  }

  // 지정한 세 언어가 다 비었으면 아무거나 채워진 것을 쓴다.
  // 빈 화면보다는 낫다.
  return rows.map(usable).find(Boolean) ?? null;
}

/** 번역 진행률. 관리자 화면에서 "3/10" 으로 보여준다. */
export function translationProgress(
  rows: { locale: string; is_reviewed?: boolean }[] | null | undefined,
  total: number,
) {
  const filled = rows?.length ?? 0;
  const reviewed = rows?.filter((r) => r.is_reviewed).length ?? 0;
  return { filled, reviewed, total };
}
