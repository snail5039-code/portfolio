import { createPublicClient } from "@/lib/supabase/public";
import { pickTranslation } from "./translation";
import { ilikeAny, likeSafe } from "./safe";

export type CategorySlug =
  | "office"
  | "games"
  | "utilities"
  | "webapps"
  | "labs";

export type ProductKind = "download" | "webapp" | "source";

export type Release = {
  id: string;
  version: string;
  platform: string;
  assetUrl: string;
  fileSize: number | null;
  releasedAt: string;
};

export type Product = {
  id: string;
  slug: string;
  kind: ProductKind;
  category: CategorySlug | null;
  iconLetter: string | null;
  platforms: string[];
  isFree: boolean;
  externalUrl: string | null;
  downloadCount: number;
  publishedAt: string | null;
  isFeatured: boolean;
  /** 폴백까지 거친 뒤의 값. 화면에서 빈 값을 만날 일이 없다. */
  name: string;
  tagline: string | null;
  description: string | null;
  requirements: string | null;
  /** 브라우저에서 바로 해볼 수 있는 주소. iframe으로 띄운다. */
  demoUrl: string | null;
  /** 동작 영상 (YouTube 또는 mp4). */
  videoUrl: string | null;
  /** 스크린샷. sort_order 순. */
  images: { path: string; alt: string | null }[];
  /** 최신 안정 릴리스. 웹앱이나 아직 배포 전이면 null. */
  latest: Release | null;
};

// PostgREST 임베드로 한 번에 가져온다. 목록 화면에서 N+1을 만들지 않으려는 것.
const SELECT = `
  id, slug, kind, icon_letter, platforms, is_free, external_url,
  download_count, published_at, is_featured, demo_url, video_url,
  categories ( slug ),
  product_images ( storage_path, alt_ko, alt_en, sort_order ),
  product_translations ( locale, name, tagline, description, requirements ),
  releases ( id, version, platform, asset_url, file_size, released_at, is_latest, channel )
`;

type Raw = {
  id: string;
  slug: string;
  kind: ProductKind;
  icon_letter: string | null;
  platforms: string[] | null;
  is_free: boolean;
  external_url: string | null;
  download_count: number;
  published_at: string | null;
  is_featured: boolean;
  demo_url: string | null;
  video_url: string | null;
  categories: { slug: CategorySlug } | null;
  product_images: {
    storage_path: string;
    alt_ko: string | null;
    alt_en: string | null;
    sort_order: number;
  }[];
  product_translations: {
    locale: string;
    name: string;
    tagline: string | null;
    description: string | null;
    requirements: string | null;
  }[];
  releases: {
    id: string;
    version: string;
    platform: string;
    asset_url: string;
    file_size: number | null;
    released_at: string;
    is_latest: boolean;
    channel: string;
  }[];
};

function shape(row: Raw, locale: string): Product {
  const t = pickTranslation(row.product_translations, locale);
  const latest = row.releases?.find((r) => r.is_latest && r.channel === "stable");

  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    category: row.categories?.slug ?? null,
    iconLetter: row.icon_letter,
    platforms: row.platforms ?? [],
    isFree: row.is_free,
    externalUrl: row.external_url,
    downloadCount: row.download_count,
    publishedAt: row.published_at,
    isFeatured: row.is_featured,
    name: t?.name ?? row.slug,
    tagline: t?.tagline ?? null,
    description: t?.description ?? null,
    requirements: t?.requirements ?? null,
    demoUrl: row.demo_url,
    videoUrl: row.video_url,
    images: (row.product_images ?? [])
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({
        path: img.storage_path,
        // 대체 텍스트는 ko/en만 둔다. 10개 언어로 늘릴 만한 값이 아니다.
        alt: (locale === "ko" ? img.alt_ko : img.alt_en) ?? img.alt_en ?? img.alt_ko,
      })),
    latest: latest
      ? {
          id: latest.id,
          version: latest.version,
          platform: latest.platform,
          assetUrl: latest.asset_url,
          fileSize: latest.file_size,
          releasedAt: latest.released_at,
        }
      : null,
  };
}

/**
 * 검색어와 맞은 번역만 골라내는 임베드.
 *
 * 화면에 쓸 번역은 SELECT 가 이미 10개 언어 전부 가져온다. 여기 하나를 더
 * 붙이는 것은 거르기 위한 것이다 — `!inner` 라서 맞은 번역이 하나도 없는
 * 제품은 결과에서 빠진다. 어느 언어로 맞아도 찾되 보여줄 때는 보고 있는
 * 언어로 고르는 규칙을 한 번의 조회로 지키려는 것.
 * (사이트 전체 검색 lib/queries/search.ts 와 같은 방식)
 */
const HIT = `, hit:product_translations!inner ( locale )`;

/**
 * 발행된 제품 목록.
 * RLS가 발행분만 돌려주므로 여기서 status를 다시 거를 필요는 없지만,
 * 관리자가 볼 때도 목록 화면은 발행분만 보여야 해서 명시한다.
 */
export async function listProducts(
  locale: string,
  options: { category?: CategorySlug; limit?: number; term?: string } = {},
): Promise<Product[]> {
  const supabase = createPublicClient();
  const term = likeSafe(options.term ?? "");

  let query = supabase
    .from("products")
    .select(term ? SELECT + HIT : SELECT)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false });

  if (term) {
    query = query.or(ilikeAny(["name", "tagline", "description"], term), {
      referencedTable: "hit",
    });
  }
  if (options.category) {
    query = query.eq("categories.slug", options.category);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as unknown as Raw[]).map((row) => shape(row, locale));
}

export async function getProduct(
  slug: string,
  locale: string,
): Promise<Product | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return shape(data as unknown as Raw, locale);
}

export type Stats = {
  productCount: number;
  monthlyDownloads: number;
  totalDownloads: number;
  lastUpdated: string | null;
};

/**
 * 홈 상단 통계. 진짜 값만 쓴다 — 0이면 0을 보여준다.
 *
 * 다운로드 수를 테이블에서 직접 세지 않고 함수를 부른다.
 * RLS가 남의 다운로드 기록을 막아서, 비로그인 방문자가 직접 세면 언제나 0이 나온다.
 */
export async function getStats(): Promise<Stats> {
  const supabase = createPublicClient();

  const { data, error } = await supabase.rpc("public_stats").single();
  if (error) throw error;

  const row = data as {
    product_count: number;
    monthly_downloads: number;
    total_downloads: number;
    last_updated: string | null;
  };

  return {
    productCount: row.product_count,
    monthlyDownloads: Number(row.monthly_downloads),
    totalDownloads: Number(row.total_downloads),
    lastUpdated: row.last_updated,
  };
}
