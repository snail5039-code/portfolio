import { setRequestLocale } from "next-intl/server";
import { ProductsPage } from "@/components/product/ProductsPage";
import { PRODUCTS } from "@/lib/fixtures";
import type { CategorySlug } from "@/lib/queries/products";

export default async function PreviewProducts({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { category, q } = await searchParams;

  const term = (q ?? "").trim().slice(0, 100);

  // 목업이라 DB 를 타지 않는다. 검색창이 화면에 있는데 아무 일도 안 하면
  // 목업을 보는 사람이 기능이 깨진 줄 안다 — 그래서 예시 데이터도 걸러준다.
  const products = term
    ? PRODUCTS.filter((p) =>
        [p.name, p.tagline, p.description]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term.toLowerCase())),
      )
    : PRODUCTS;

  return (
    <ProductsPage
      products={products}
      active={category as CategorySlug | undefined}
      basePath="/preview/products"
      locale={locale}
      search={term}
    />
  );
}
