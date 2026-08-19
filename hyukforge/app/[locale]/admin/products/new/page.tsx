import { ProductForm } from "@/components/admin/ProductForm";
import { emptyDraft, listCategories } from "@/lib/queries/admin";

export default async function NewProduct({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const categories = await listCategories();

  return (
    <ProductForm initial={emptyDraft()} categories={categories} locale={locale} />
  );
}
