import { setRequestLocale } from "next-intl/server";
import { ProductDetail } from "@/components/product/ProductDetail";
import { CHANGELOG, PRODUCTS } from "@/lib/fixtures";

/** 웹앱형 상세 — 미리보기의 '체험' 탭을 확인하는 자리다. */
export default async function PreviewProductDemo({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const product = PRODUCTS.find((p) => p.slug === "commute-battle")!;
  const history = CHANGELOG.filter((c) => c.productSlug === product.slug);
  return <ProductDetail product={product} history={history} locale={locale} />;
}
