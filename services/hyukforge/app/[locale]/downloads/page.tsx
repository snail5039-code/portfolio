import { setRequestLocale } from "next-intl/server";
import { DownloadsPage } from "@/components/pages/DownloadsPage";
import { listProducts } from "@/lib/queries/products";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

/** 검색어를 이보다 길게 받지 않는다. 게시판·전체 검색과 같은 값이다. */
const MAX_TERM = 100;

export default async function Downloads({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { q } = await searchParams;

  const term = (q ?? "").slice(0, MAX_TERM);

  const products = await listProducts(locale, { term }).catch(
    orEmpty([], "products"),
  );
  return <DownloadsPage products={products} search={term} />;
}
