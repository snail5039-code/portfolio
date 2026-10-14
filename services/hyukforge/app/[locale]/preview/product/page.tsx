import { setRequestLocale } from "next-intl/server";
import { ProductDetail } from "@/components/product/ProductDetail";
import { CHANGELOG, FEATURED } from "@/lib/fixtures";

export default async function PreviewProduct({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const history = CHANGELOG.filter((c) => c.productSlug === FEATURED.slug);
  return <ProductDetail product={FEATURED} history={history} locale={locale} />;
}
