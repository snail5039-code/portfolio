import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/product/ProductsPage";
import { listProducts, type CategorySlug } from "@/lib/queries/products";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

/** 검색어를 이보다 길게 받지 않는다. 게시판·전체 검색과 같은 값이다. */
const MAX_TERM = 100;

export default async function Products({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { category, q } = await searchParams;

  const term = (q ?? "").slice(0, MAX_TERM);

  // 분류 필터는 클라이언트에서 걸러도 되는 양이라 전체를 한 번에 가져온다.
  // 검색은 DB 에 맡긴다 — 화면에 보이는 언어만 훑으면 한국어 화면에서
  // 영어 소개에만 있는 말을 못 찾는다. (lib/queries/products.ts 의 HIT)
  const products = await listProducts(locale, { term }).catch(
    orEmpty([], "products"),
  );

  return (
    <ProductsPage
      products={products}
      active={category as CategorySlug | undefined}
      locale={locale}
      search={term}
    />
  );
}
