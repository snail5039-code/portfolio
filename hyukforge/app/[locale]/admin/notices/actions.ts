"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { locales } from "@/i18n/routing";
import type { NoticeDraft } from "@/lib/queries/admin-content";

/**
 * 공지 저장.
 *
 * 제품과 같은 규칙이다 — RLS 가 이미 막고 있지만 여기서도 확인한다.
 * 정책에만 기대면 나중에 정책을 손댈 때 이 경로가 조용히 열린다.
 * (app/[locale]/admin/products/actions.ts)
 */
export type SaveResult = { ok: true; id: string } | { ok: false; message: string };

export async function saveNotice(draft: NoticeDraft): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const slug = draft.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) {
    return {
      ok: false,
      message: "주소(slug)는 영문 소문자·숫자·하이픈만 쓸 수 있고 3자 이상이어야 합니다.",
    };
  }

  // 공지는 제목과 본문이 한 쌍이다. ko 는 반드시 있어야 폴백이 성립한다.
  if (!draft.translations.ko?.title?.trim() || !draft.translations.ko?.body?.trim()) {
    return { ok: false, message: "ko 제목과 본문은 반드시 채워야 합니다." };
  }

  // 발행 상태는 발행 시각이 있어야 한다 (notices_published_needs_date).
  let publishedAt: string | null = draft.publishedAt
    ? new Date(draft.publishedAt).toISOString()
    : null;
  if (draft.status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  const supabase = await createClient();

  const row = {
    slug,
    status: draft.status,
    is_pinned: draft.isPinned,
    published_at: publishedAt,
  };

  const saved = draft.id
    ? await supabase.from("notices").update(row).eq("id", draft.id).select("id").maybeSingle()
    : await supabase.from("notices").insert(row).select("id").maybeSingle();

  if (saved.error) return { ok: false, message: readable(saved.error.message) };
  const id = (saved.data as { id: string } | null)?.id;
  if (!id) return { ok: false, message: "저장은 됐지만 결과를 읽지 못했습니다." };

  // 제목과 본문이 둘 다 있는 언어만 행을 만든다.
  // 한쪽만 있으면 화면에 반쪽짜리 공지가 뜬다.
  const rows = locales
    .filter(
      (l) => draft.translations[l]?.title?.trim() && draft.translations[l]?.body?.trim(),
    )
    .map((l) => ({
      notice_id: id,
      locale: l,
      title: draft.translations[l].title.trim(),
      body: draft.translations[l].body.trim(),
      is_reviewed: draft.translations[l].isReviewed,
    }));

  if (rows.length) {
    const up = await supabase
      .from("notice_translations")
      .upsert(rows, { onConflict: "notice_id,locale" });
    if (up.error) return { ok: false, message: readable(up.error.message) };
  }

  const keep = rows.map((r) => r.locale);
  const del = await supabase
    .from("notice_translations")
    .delete()
    .eq("notice_id", id)
    .not("locale", "in", `(${keep.length ? keep.join(",") : "''"})`);
  if (del.error) return { ok: false, message: readable(del.error.message) };

  refresh();
  return { ok: true, id };
}

export async function deleteNotice(id: string): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("notices").delete().eq("id", id);
  if (error) return { ok: false, message: readable(error.message) };

  refresh();
  return { ok: true, id };
}

/** 공지 목록·상세는 정적으로 만들어 둔다 (revalidate 300). 바뀌면 바로 무효화한다. */
function refresh() {
  for (const l of locales) {
    revalidatePath(`/${l}/notices`);
    revalidatePath(`/${l}/notices/[slug]`, "page");
    revalidatePath(`/${l}`);
  }
}

function readable(message: string): string {
  if (message.includes("notices_slug_key")) {
    return "같은 주소(slug)를 쓰는 공지가 이미 있습니다.";
  }
  if (message.includes("notices_published_needs_date")) {
    return "발행 상태에는 발행 시각이 필요합니다.";
  }
  if (message.includes("notices_status_known")) {
    return "상태는 초안·발행·보관 중 하나여야 합니다.";
  }
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  return message;
}
