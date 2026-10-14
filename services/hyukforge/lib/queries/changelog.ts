import { createPublicClient } from "@/lib/supabase/public";
import { pickTranslation } from "./translation";

export type ChangelogEntry = {
  id: string;
  date: string;
  /** 스튜디오 전체 소식이면 null */
  productName: string | null;
  productSlug: string | null;
  body: string;
};

type Raw = {
  id: string;
  entry_date: string;
  products: {
    slug: string;
    product_translations: { locale: string; name: string }[];
  } | null;
  changelog_translations: { locale: string; body: string }[];
};

export async function listChangelog(
  locale: string,
  limit = 20,
): Promise<ChangelogEntry[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("changelog_entries")
    .select(
      `id, entry_date,
       products ( slug, product_translations ( locale, name ) ),
       changelog_translations ( locale, body )`,
    )
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data as unknown as Raw[])
    .map((row) => {
      const body = pickTranslation(row.changelog_translations, locale, "body");
      // 어떤 언어로도 내용이 없으면 빈 줄이 되므로 아예 내보내지 않는다
      if (!body) return null;

      const name = row.products
        ? pickTranslation(row.products.product_translations, locale)
        : null;

      return {
        id: row.id,
        date: row.entry_date,
        productName: name?.name ?? null,
        productSlug: row.products?.slug ?? null,
        body: body.body,
      };
    })
    .filter((e): e is ChangelogEntry => e !== null);
}
