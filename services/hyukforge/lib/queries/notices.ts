import { createPublicClient } from "@/lib/supabase/public";
import { pickTranslation } from "./translation";

/**
 * 공지. 개발 기록(changelog)과 다르다.
 * 개발 기록은 "무엇을 고쳤다"이고, 공지는 "알아두셔야 할 것"이다.
 */
export type Notice = {
  id: string;
  slug: string;
  isPinned: boolean;
  publishedAt: string | null;
  title: string;
  body: string;
};

type Raw = {
  id: string;
  slug: string;
  is_pinned: boolean;
  published_at: string | null;
  notice_translations: { locale: string; title: string; body: string }[];
};

const SELECT = `
  id, slug, is_pinned, published_at,
  notice_translations ( locale, title, body )
`;

function shape(row: Raw, locale: string): Notice | null {
  const t = pickTranslation(row.notice_translations, locale, "title");
  // 어떤 언어로도 제목이 없으면 목록에 빈 줄이 되므로 내보내지 않는다
  if (!t) return null;

  return {
    id: row.id,
    slug: row.slug,
    isPinned: row.is_pinned,
    publishedAt: row.published_at,
    title: t.title,
    body: t.body,
  };
}

export async function listNotices(
  locale: string,
  limit = 30,
): Promise<Notice[]> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("notices")
    .select(SELECT)
    .eq("status", "published")
    // 고정 공지가 항상 맨 위
    .order("is_pinned", { ascending: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;

  return (data as unknown as Raw[])
    .map((row) => shape(row, locale))
    .filter((n): n is Notice => n !== null);
}

export async function getNotice(
  slug: string,
  locale: string,
): Promise<Notice | null> {
  const supabase = createPublicClient();

  const { data, error } = await supabase
    .from("notices")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return shape(data as unknown as Raw, locale);
}
