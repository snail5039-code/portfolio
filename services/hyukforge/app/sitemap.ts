import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { locales, defaultLocale } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/**
 * 사이트맵.
 *
 * 10개 언어라 주소 수가 금방 불어난다. 언어마다 따로 넣되 alternates 로 서로를
 * 가리키게 한다 — 그래야 검색엔진이 같은 문서의 번역본으로 알아본다.
 * 안 그러면 10개가 서로 중복 문서로 잡힌다.
 *
 * 개인 화면과 목업은 넣지 않는다 (lib/site.ts 의 PRIVATE_PATHS).
 * 게시판 글도 넣지 않는다 — 사용자가 쓰는 글이라 내용을 보증할 수 없고,
 * 스팸이 올라오면 그대로 색인된다. 게시판 목록만 넣는다.
 *
 * 제품·공지는 DB 에서 읽는다. 새로 발행해도 한 시간 안에 반영된다.
 */
export const revalidate = 3600;

/** 언어 접두사가 붙는 고정 경로. localePrefix 가 'always' 라 기본 언어도 붙는다. */
const STATIC_PATHS = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/products", priority: 0.9, changeFrequency: "weekly" as const },
  { path: "/downloads", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/changelog", priority: 0.7, changeFrequency: "weekly" as const },
  { path: "/notices", priority: 0.6, changeFrequency: "weekly" as const },
  { path: "/board/free", priority: 0.6, changeFrequency: "daily" as const },
  { path: "/board/request", priority: 0.6, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.5, changeFrequency: "monthly" as const },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" as const },
];

/** 한 경로의 10개 언어 주소를 서로 가리키게 만든다. */
function entry(
  base: string,
  path: string,
  opts: { lastModified?: Date; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] },
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    locales.map((l) => [l, `${base}/${l}${path}`]),
  );

  return locales.map((l) => ({
    url: `${base}/${l}${path}`,
    lastModified: opts.lastModified,
    changeFrequency: opts.changeFrequency,
    priority: opts.priority,
    alternates: {
      languages: {
        ...languages,
        // 언어를 모르는 크롤러에게 줄 기본본
        "x-default": `${base}/${defaultLocale}${path}`,
      },
    },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = createPublicClient();

  // RLS 가 발행된 것만 돌려준다. 초안이 사이트맵에 새는 일이 없다.
  const [products, notices] = await Promise.all([
    supabase.from("products").select("slug, updated_at").then((r) => r.data ?? []),
    supabase.from("notices").select("slug, updated_at").then((r) => r.data ?? []),
  ]);

  const pages = STATIC_PATHS.flatMap((p) =>
    entry(base, p.path, { priority: p.priority, changeFrequency: p.changeFrequency }),
  );

  const productPages = (products as { slug: string; updated_at: string }[]).flatMap((p) =>
    entry(base, `/products/${p.slug}`, {
      lastModified: new Date(p.updated_at),
      priority: 0.9,
      changeFrequency: "weekly",
    }),
  );

  const noticePages = (notices as { slug: string; updated_at: string }[]).flatMap((n) =>
    entry(base, `/notices/${n.slug}`, {
      lastModified: new Date(n.updated_at),
      priority: 0.5,
      changeFrequency: "monthly",
    }),
  );

  return [...pages, ...productPages, ...noticePages];
}
