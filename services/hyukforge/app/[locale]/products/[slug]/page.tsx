import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { ProductDetail } from "@/components/product/ProductDetail";
import { getProduct } from "@/lib/queries/products";
import { listChangelog } from "@/lib/queries/changelog";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

type Params = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const p = await getProduct(slug, locale).catch(() => null);
  if (!p) return {};

  return {
    title: p.name,
    description: p.tagline ?? undefined,
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const product = await getProduct(slug, locale).catch(orEmpty(null, "product"));
  if (!product) notFound();

  const history = (
    await listChangelog(locale, 50).catch(orEmpty([], "changelog"))
  ).filter((e) => e.productSlug === slug);

  return <ProductDetail product={product} history={history} locale={locale} />;
}
