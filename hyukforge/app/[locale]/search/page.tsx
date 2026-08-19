import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SearchPage } from "@/components/pages/SearchPage";
import { searchAll } from "@/lib/queries/search";
import { orEmpty } from "@/lib/queries/safe";

/**
 * 사이트 전체 검색.
 *
 * 검색어가 주소에 있어서 정적으로 만들 수 없다. 캐시해도 값어치가 없다 —
 * 같은 검색어가 두 번 들어올 일이 드물다.
 *
 * 색인은 막는다. 검색 결과 페이지가 색인되면 같은 내용이 검색어마다
 * 다른 주소로 중복 등록된다. robots.txt 에도 같이 적어둔다 (app/robots.ts).
 */
export const dynamic = "force-dynamic";

type Params = { locale: string };
type Search = { q?: string };

/** 검색어를 이보다 길게 받지 않는다. 게시판 검색과 같은 값이다. */
const MAX_TERM = 100;

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  return {
    title: t("search.title"),
    robots: { index: false, follow: true },
  };
}

export default async function Search({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  const { q } = await searchParams;
  setRequestLocale(locale);

  const term = (q ?? "").slice(0, MAX_TERM);

  const result = await searchAll(term, locale).catch(
    orEmpty({ term, hits: [] }, "search"),
  );

  return <SearchPage result={result} />;
}
