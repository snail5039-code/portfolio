import { createPublicClient } from "@/lib/supabase/public";
import { pickTranslation } from "./translation";
import { ilikeAny, likeSafe } from "./safe";
import { BOARDS, type BoardSlug } from "@/lib/board";

/**
 * 사이트 전체 검색.
 *
 * 제품·공지·개발 기록·게시글을 한 번에 찾는다. 게시판 검색(lib/queries/board.ts)은
 * 그대로 둔다 — 게시판 안에서 찾는 것과 사이트 전체에서 찾는 것은 다른 일이고,
 * 게시판 쪽은 쪽 넘기기와 내 숨겨진 글까지 다룬다.
 *
 * 번역된 내용은 **어느 언어로 맞아도** 결과에 넣는다. 한국어 화면에서
 * "emergency" 를 찾아도 나와야 하기 때문이다. 대신 화면에 띄우는 제목·본문은
 * 보고 있는 언어로 고른다 (pickTranslation).
 *
 * 그걸 한 번의 조회로 하려고 같은 번역 표를 두 번 임베드한다.
 *   · `product_translations`      — 화면에 쓸 10개 언어 전부
 *   · `hit:product_translations!inner` — 검색어와 맞은 것. inner 라서
 *     맞은 번역이 하나도 없는 제품은 아예 빠진다.
 * 두 번 조회해서 id 를 모았다가 다시 읽는 방법도 있지만, 왕복이 두 배가 된다.
 *
 * 공개 클라이언트(anon)를 쓰므로 RLS 를 그대로 탄다. 초안 제품, 숨겨진 글,
 * 발행 안 한 공지는 검색으로도 나오지 않는다.
 */

export type HitKind = "product" | "notice" | "changelog" | "post";

export type Hit = {
  kind: HitKind;
  /** 언어 접두사가 없는 내부 주소. i18n 의 Link 가 붙인다. */
  href: string;
  title: string;
  /** 검색어 주변만 잘라낸 본문 */
  snippet: string | null;
  date: string | null;
  /** 종류마다 다른 부가 정보 — 개발 기록은 제품명, 글은 게시판 이름 */
  meta: string | null;
};

export type SearchResult = {
  term: string;
  hits: Hit[];
};

/** 종류마다 이만큼까지만. 넘치면 화면이 한 종류로 뒤덮인다. */
const PER_KIND = 20;

/** 검색어를 가운데 두고 앞뒤로 이만큼 보여준다. */
const AROUND = 60;

/**
 * 검색어가 나온 자리를 잘라낸다.
 *
 * 앞에서 한 줄 자르면 정작 맞은 부분이 안 보인다 — 본문 아래쪽에서 맞은
 * 개발 기록이 특히 그렇다. 그래서 맞은 자리를 가운데 둔다.
 */
export function excerpt(
  text: string | null | undefined,
  term: string,
): string | null {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return null;

  const at = term ? flat.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (at < 0) {
    return flat.length > AROUND * 2 ? `${flat.slice(0, AROUND * 2)}…` : flat;
  }

  const from = Math.max(0, at - AROUND);
  const to = Math.min(flat.length, at + term.length + AROUND);
  return `${from > 0 ? "…" : ""}${flat.slice(from, to)}${to < flat.length ? "…" : ""}`;
}

type ProductRow = {
  slug: string;
  published_at: string | null;
  product_translations: {
    locale: string;
    name: string;
    tagline: string | null;
    description: string | null;
  }[];
};

type NoticeRow = {
  slug: string;
  published_at: string | null;
  notice_translations: { locale: string; title: string; body: string }[];
};

type ChangelogRow = {
  entry_date: string;
  products: {
    slug: string;
    product_translations: { locale: string; name: string }[];
  } | null;
  changelog_translations: { locale: string; body: string }[];
};

type PostRow = {
  id: string;
  board: string;
  title: string;
  body: string;
  created_at: string;
};

export async function searchAll(
  rawTerm: string,
  locale: string,
): Promise<SearchResult> {
  const term = likeSafe(rawTerm);
  if (!term) return { term: "", hits: [] };

  const supabase = createPublicClient();

  // 네 종류를 동시에 조회한다. 하나가 느려도 다른 셋을 기다리게 하지 않는다.
  const [products, notices, changelog, posts] = await Promise.all([
    supabase
      .from("products")
      .select(
        `slug, published_at,
         product_translations ( locale, name, tagline, description ),
         hit:product_translations!inner ( locale )`,
      )
      .eq("status", "published")
      .or(ilikeAny(["name", "tagline", "description"], term), {
        referencedTable: "hit",
      })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(PER_KIND),

    supabase
      .from("notices")
      .select(
        `slug, published_at,
         notice_translations ( locale, title, body ),
         hit:notice_translations!inner ( locale )`,
      )
      .eq("status", "published")
      .or(ilikeAny(["title", "body"], term), { referencedTable: "hit" })
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(PER_KIND),

    supabase
      .from("changelog_entries")
      .select(
        `entry_date,
         products ( slug, product_translations ( locale, name ) ),
         changelog_translations ( locale, body ),
         hit:changelog_translations!inner ( locale )`,
      )
      .or(ilikeAny(["body"], term), { referencedTable: "hit" })
      .order("entry_date", { ascending: false })
      .limit(PER_KIND),

    // 게시글은 번역하지 않는다 (docs/HANDOFF.md 설계 원칙). 쓴 그대로 찾는다.
    supabase
      .from("posts")
      .select("id, board, title, body, created_at")
      .eq("status", "published")
      .or(ilikeAny(["title", "body"], term))
      .order("created_at", { ascending: false })
      .limit(PER_KIND),
  ]);

  // 한 종류가 실패해도 나머지는 보여준다. 조용히 삼키지 않고 로그를 남긴다.
  for (const [label, res] of [
    ["products", products],
    ["notices", notices],
    ["changelog", changelog],
    ["posts", posts],
  ] as const) {
    if (res.error) console.error(`[search:${label}] 조회 실패`, res.error);
  }

  const hits: Hit[] = [];

  for (const row of (products.data ?? []) as unknown as ProductRow[]) {
    const t = pickTranslation(row.product_translations, locale);
    hits.push({
      kind: "product",
      href: `/products/${row.slug}`,
      title: t?.name ?? row.slug,
      snippet: t?.tagline ?? excerpt(t?.description, rawTerm),
      date: row.published_at,
      meta: null,
    });
  }

  for (const row of (notices.data ?? []) as unknown as NoticeRow[]) {
    const t = pickTranslation(row.notice_translations, locale, "title");
    hits.push({
      kind: "notice",
      href: `/notices/${row.slug}`,
      title: t?.title ?? row.slug,
      snippet: excerpt(t?.body, rawTerm),
      date: row.published_at,
      meta: null,
    });
  }

  for (const row of (changelog.data ?? []) as unknown as ChangelogRow[]) {
    const t = pickTranslation(row.changelog_translations, locale, "body");
    // 어떤 언어로도 내용이 없으면 목록에 빈 줄이 된다 (lib/queries/changelog.ts 와 같은 규칙)
    if (!t) continue;
    const product = row.products
      ? pickTranslation(row.products.product_translations, locale)
      : null;

    hits.push({
      kind: "changelog",
      // 개발 기록에는 자기 주소가 없다. 제품에 딸린 것이면 그 제품의 상세로,
      // 스튜디오 소식이면 개발 기록 목록으로 보낸다.
      href: row.products ? `/products/${row.products.slug}` : "/changelog",
      title: excerpt(t.body, rawTerm) ?? t.body,
      snippet: null,
      date: row.entry_date,
      meta: product?.name ?? null,
    });
  }

  for (const row of (posts.data ?? []) as unknown as PostRow[]) {
    const board: BoardSlug = (BOARDS as readonly string[]).includes(row.board)
      ? (row.board as BoardSlug)
      : "free";

    hits.push({
      kind: "post",
      href: `/board/${board}/${row.id}`,
      title: row.title,
      snippet: excerpt(row.body, rawTerm),
      date: row.created_at,
      meta: board,
    });
  }

  return { term: rawTerm, hits };
}
