import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/routing";
import type { CategorySlug, ProductKind } from "./products";

/**
 * 관리자용 조회.
 *
 * 공개 조회(lib/queries/products.ts)와 달리 세션을 읽는 클라이언트를 쓴다.
 * is_admin() 이 true 여야 초안(draft)까지 보인다.
 */

export type AdminProductRow = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  kind: ProductKind;
  category: CategorySlug | null;
  isFeatured: boolean;
  downloadCount: number;
  publishedAt: string | null;
  updatedAt: string;
  /** 어느 언어로든 채워진 이름. 없으면 slug */
  name: string;
  /** 번역 진행률 — 작성된 언어 수 / 전체 */
  filled: number;
  reviewed: number;
  total: number;
  releaseCount: number;
};

export async function listAllProducts(): Promise<AdminProductRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, status, kind, is_featured, download_count, published_at, updated_at,
       categories ( slug ),
       product_translations ( locale, name, is_reviewed ),
       releases ( id )`,
    )
    .order("updated_at", { ascending: false });

  if (error) throw error;

  type Raw = {
    id: string;
    slug: string;
    status: "draft" | "published" | "archived";
    kind: ProductKind;
    is_featured: boolean;
    download_count: number;
    published_at: string | null;
    updated_at: string;
    categories: { slug: CategorySlug } | null;
    product_translations: { locale: string; name: string; is_reviewed: boolean }[];
    releases: { id: string }[];
  };

  return (data as unknown as Raw[]).map((r) => {
    const t = r.product_translations ?? [];
    const named = t.find((x) => x.locale === "ko") ?? t.find((x) => x.name?.trim());
    return {
      id: r.id,
      slug: r.slug,
      status: r.status,
      kind: r.kind,
      category: r.categories?.slug ?? null,
      isFeatured: r.is_featured,
      downloadCount: r.download_count,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
      name: named?.name?.trim() || r.slug,
      filled: t.filter((x) => x.name?.trim()).length,
      reviewed: t.filter((x) => x.is_reviewed).length,
      total: locales.length,
      releaseCount: r.releases?.length ?? 0,
    };
  });
}

export type ProductDraft = {
  id: string | null;
  slug: string;
  categoryId: string | null;
  kind: ProductKind;
  status: "draft" | "published" | "archived";
  iconLetter: string;
  platforms: string[];
  isFeatured: boolean;
  externalUrl: string;
  githubRepo: string;
  sourceUrl: string;
  demoUrl: string;
  videoUrl: string;
  requiresLogin: boolean;
  isFree: boolean;
  priceKrw: string;
  checkoutUrl: string;
  publishedAt: string;
  translations: Record<
    string,
    { name: string; tagline: string; description: string; requirements: string; isReviewed: boolean }
  >;
};

export const EMPTY_TRANSLATION = {
  name: "",
  tagline: "",
  description: "",
  requirements: "",
  isReviewed: false,
};

export function emptyDraft(): ProductDraft {
  return {
    id: null,
    slug: "",
    categoryId: null,
    kind: "download",
    status: "draft",
    iconLetter: "",
    platforms: [],
    isFeatured: false,
    externalUrl: "",
    githubRepo: "",
    sourceUrl: "",
    demoUrl: "",
    videoUrl: "",
    requiresLogin: true,
    isFree: true,
    priceKrw: "",
    checkoutUrl: "",
    publishedAt: "",
    translations: Object.fromEntries(
      locales.map((l) => [l, { ...EMPTY_TRANSLATION }]),
    ),
  };
}

export async function getProductDraft(id: string): Promise<ProductDraft | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select(
      `id, slug, category_id, kind, status, icon_letter, platforms, is_featured,
       external_url, github_repo, source_url, demo_url, video_url,
       requires_login, is_free, price_krw, checkout_url, published_at,
       product_translations ( locale, name, tagline, description, requirements, is_reviewed )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const r = data as Record<string, unknown> & {
    product_translations: {
      locale: string;
      name: string | null;
      tagline: string | null;
      description: string | null;
      requirements: string | null;
      is_reviewed: boolean;
    }[];
  };

  const draft = emptyDraft();
  const s = (v: unknown) => (v == null ? "" : String(v));

  return {
    ...draft,
    id: s(r.id),
    slug: s(r.slug),
    categoryId: r.category_id ? s(r.category_id) : null,
    kind: r.kind as ProductKind,
    status: r.status as ProductDraft["status"],
    iconLetter: s(r.icon_letter),
    platforms: (r.platforms as string[]) ?? [],
    isFeatured: !!r.is_featured,
    externalUrl: s(r.external_url),
    githubRepo: s(r.github_repo),
    sourceUrl: s(r.source_url),
    demoUrl: s(r.demo_url),
    videoUrl: s(r.video_url),
    requiresLogin: !!r.requires_login,
    isFree: !!r.is_free,
    priceKrw: s(r.price_krw),
    checkoutUrl: s(r.checkout_url),
    // datetime-local 입력이 받는 형식으로 자른다
    publishedAt: r.published_at ? s(r.published_at).slice(0, 16) : "",
    translations: {
      ...draft.translations,
      ...Object.fromEntries(
        (r.product_translations ?? []).map((t) => [
          t.locale,
          {
            name: s(t.name),
            tagline: s(t.tagline),
            description: s(t.description),
            requirements: s(t.requirements),
            isReviewed: !!t.is_reviewed,
          },
        ]),
      ),
    },
  };
}

export async function listCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, sort_order")
    .order("sort_order");
  if (error) throw error;
  return data as { id: string; slug: CategorySlug; sort_order: number }[];
}

/** 현재 로그인한 사용자가 관리자인가 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return (data as { role?: string } | null)?.role === "admin";
}

export type AdminRelease = {
  id: string;
  version: string;
  channel: string;
  platform: string;
  assetUrl: string;
  fileSize: number | null;
  isLatest: boolean;
  releasedAt: string;
};

export async function listReleases(productId: string): Promise<AdminRelease[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("id, version, channel, platform, asset_url, file_size, is_latest, released_at")
    .eq("product_id", productId)
    .order("released_at", { ascending: false });

  if (error) throw error;

  return (data as unknown as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    version: String(r.version),
    channel: String(r.channel),
    platform: String(r.platform),
    assetUrl: String(r.asset_url),
    fileSize: r.file_size == null ? null : Number(r.file_size),
    isLatest: !!r.is_latest,
    releasedAt: String(r.released_at),
  }));
}

/** 제품 수정 화면의 스크린샷 목록. 관리자라 초안 제품의 것도 보인다. */
export async function listProductImages(productId: string): Promise<
  { id: string; path: string; altKo: string | null; altEn: string | null }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, storage_path, alt_ko, alt_en")
    .eq("product_id", productId)
    .order("sort_order");

  if (error) throw error;

  return (data as unknown as {
    id: string;
    storage_path: string;
    alt_ko: string | null;
    alt_en: string | null;
  }[]).map((r) => ({
    id: r.id,
    path: r.storage_path,
    altKo: r.alt_ko,
    altEn: r.alt_en,
  }));
}
