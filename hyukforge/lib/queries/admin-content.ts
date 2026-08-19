import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/routing";

/**
 * 공지와 개발 기록의 관리자용 조회.
 *
 * 공개 조회(lib/queries/notices.ts · changelog.ts)와 달리 세션을 읽는
 * 클라이언트를 쓴다. is_admin() 이 true 여야 초안까지 보인다.
 *
 * 공지는 10개 언어를 다 채운다 — notice_translations 에 is_reviewed 가 있고,
 * 그건 "기계번역을 사람이 훑었는가"를 세려고 둔 컬럼이다.
 * 개발 기록은 그 컬럼이 없다. 한 줄짜리라 ko·en 만 쓰고 나머지는 폴백에 맡긴다.
 */

/* ── 공지 ──────────────────────────────────────────────────────── */

export type NoticeDraft = {
  id: string | null;
  slug: string;
  status: "draft" | "published" | "archived";
  isPinned: boolean;
  publishedAt: string;
  translations: Record<
    string,
    { title: string; body: string; isReviewed: boolean }
  >;
};

export const EMPTY_NOTICE_TRANSLATION = { title: "", body: "", isReviewed: false };

export function emptyNoticeDraft(): NoticeDraft {
  return {
    id: null,
    slug: "",
    status: "draft",
    isPinned: false,
    publishedAt: "",
    translations: Object.fromEntries(
      locales.map((l) => [l, { ...EMPTY_NOTICE_TRANSLATION }]),
    ),
  };
}

export type AdminNoticeRow = {
  id: string;
  slug: string;
  status: "draft" | "published" | "archived";
  isPinned: boolean;
  publishedAt: string | null;
  updatedAt: string;
  /** 어느 언어로든 채워진 제목. 없으면 slug */
  title: string;
  filled: number;
  reviewed: number;
};

export async function listAllNotices(): Promise<AdminNoticeRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select(
      `id, slug, status, is_pinned, published_at, updated_at,
       notice_translations ( locale, title, is_reviewed )`,
    )
    .order("is_pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  type Raw = {
    id: string;
    slug: string;
    status: "draft" | "published" | "archived";
    is_pinned: boolean;
    published_at: string | null;
    updated_at: string;
    notice_translations: { locale: string; title: string; is_reviewed: boolean }[];
  };

  return (data as unknown as Raw[]).map((r) => {
    const t = r.notice_translations ?? [];
    const pick =
      t.find((x) => x.locale === "ko" && x.title.trim()) ??
      t.find((x) => x.title.trim());
    return {
      id: r.id,
      slug: r.slug,
      status: r.status,
      isPinned: r.is_pinned,
      publishedAt: r.published_at,
      updatedAt: r.updated_at,
      title: pick?.title ?? r.slug,
      filled: t.filter((x) => x.title.trim()).length,
      reviewed: t.filter((x) => x.is_reviewed).length,
    };
  });
}

export async function getNoticeDraft(id: string): Promise<NoticeDraft | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notices")
    .select(
      `id, slug, status, is_pinned, published_at,
       notice_translations ( locale, title, body, is_reviewed )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const r = data as unknown as {
    id: string;
    slug: string;
    status: "draft" | "published" | "archived";
    is_pinned: boolean;
    published_at: string | null;
    notice_translations: {
      locale: string;
      title: string;
      body: string;
      is_reviewed: boolean;
    }[];
  };

  const draft = emptyNoticeDraft();
  draft.id = r.id;
  draft.slug = r.slug;
  draft.status = r.status;
  draft.isPinned = r.is_pinned;
  // datetime-local 은 초 단위까지만 받는다
  draft.publishedAt = r.published_at ? r.published_at.slice(0, 16) : "";
  for (const t of r.notice_translations ?? []) {
    if (!draft.translations[t.locale]) continue;
    draft.translations[t.locale] = {
      title: t.title ?? "",
      body: t.body ?? "",
      isReviewed: t.is_reviewed,
    };
  }
  return draft;
}

/* ── 개발 기록 ─────────────────────────────────────────────────── */

export type ChangelogDraft = {
  id: string | null;
  /** 스튜디오 전체 소식이면 null */
  productId: string | null;
  entryDate: string;
  ko: string;
  en: string;
};

export function emptyChangelogDraft(): ChangelogDraft {
  return { id: null, productId: null, entryDate: "", ko: "", en: "" };
}

export type AdminChangelogRow = {
  id: string;
  date: string;
  productId: string | null;
  productName: string | null;
  ko: string;
  en: string;
};

export async function listAllChangelog(limit = 100): Promise<AdminChangelogRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("changelog_entries")
    .select(
      `id, entry_date, product_id,
       products ( slug, product_translations ( locale, name ) ),
       changelog_translations ( locale, body )`,
    )
    .order("entry_date", { ascending: false })
    .limit(limit);

  if (error) throw error;

  type Raw = {
    id: string;
    entry_date: string;
    product_id: string | null;
    products: {
      slug: string;
      product_translations: { locale: string; name: string }[];
    } | null;
    changelog_translations: { locale: string; body: string }[];
  };

  return (data as unknown as Raw[]).map((r) => {
    const body = (l: string) =>
      r.changelog_translations?.find((x) => x.locale === l)?.body ?? "";
    const names = r.products?.product_translations ?? [];
    const name =
      names.find((n) => n.locale === "ko")?.name ??
      names.find((n) => n.name?.trim())?.name ??
      r.products?.slug ??
      null;
    return {
      id: r.id,
      date: r.entry_date,
      productId: r.product_id,
      productName: name,
      ko: body("ko"),
      en: body("en"),
    };
  });
}

/** 개발 기록 폼의 제품 고르기에 쓴다. 초안까지 포함한다. */
export async function listProductChoices(): Promise<
  { id: string; label: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, product_translations ( locale, name )")
    .order("slug");

  if (error) throw error;

  return (data as unknown as {
    id: string;
    slug: string;
    product_translations: { locale: string; name: string }[];
  }[]).map((p) => {
    const t = p.product_translations ?? [];
    const name =
      t.find((x) => x.locale === "ko")?.name ??
      t.find((x) => x.name?.trim())?.name ??
      p.slug;
    return { id: p.id, label: name };
  });
}
