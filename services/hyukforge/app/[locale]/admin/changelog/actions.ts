"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { locales } from "@/i18n/routing";
import type { ChangelogDraft } from "@/lib/queries/admin-content";

/**
 * 개발 기록 저장.
 *
 * 한 줄짜리라 ko·en 만 받는다. changelog_translations 에는 is_reviewed 가 없다 —
 * 10개 언어를 채울 대상이 아니라는 뜻이고, 나머지는 폴백(요청 → en → ko)이 맡는다.
 * (lib/queries/translation.ts)
 */
export type SaveResult = { ok: true; id: string } | { ok: false; message: string };

export async function saveChangelogEntry(draft: ChangelogDraft): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const ko = draft.ko.trim();
  const en = draft.en.trim();
  if (!ko) return { ok: false, message: "ko 내용은 반드시 채워야 합니다." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.entryDate)) {
    return { ok: false, message: "날짜를 골라주세요." };
  }

  const supabase = await createClient();

  const row = {
    product_id: draft.productId,
    entry_date: draft.entryDate,
  };

  const saved = draft.id
    ? await supabase
        .from("changelog_entries")
        .update(row)
        .eq("id", draft.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("changelog_entries").insert(row).select("id").maybeSingle();

  if (saved.error) return { ok: false, message: readable(saved.error.message) };
  const id = (saved.data as { id: string } | null)?.id;
  if (!id) return { ok: false, message: "저장은 됐지만 결과를 읽지 못했습니다." };

  const rows = [
    { entry_id: id, locale: "ko", body: ko },
    ...(en ? [{ entry_id: id, locale: "en", body: en }] : []),
  ];

  const up = await supabase
    .from("changelog_translations")
    .upsert(rows, { onConflict: "entry_id,locale" });
  if (up.error) return { ok: false, message: readable(up.error.message) };

  // en 을 비웠으면 행을 지운다. 남겨두면 en 화면에 옛 문장이 계속 뜬다.
  if (!en) {
    const del = await supabase
      .from("changelog_translations")
      .delete()
      .eq("entry_id", id)
      .eq("locale", "en");
    if (del.error) return { ok: false, message: readable(del.error.message) };
  }

  refresh();
  return { ok: true, id };
}

export async function deleteChangelogEntry(id: string): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("changelog_entries").delete().eq("id", id);
  if (error) return { ok: false, message: readable(error.message) };

  refresh();
  return { ok: true, id };
}

/**
 * 개발 기록은 홈의 "최근 업데이트"에도 들어간다 (public_stats).
 * 그래서 홈까지 같이 무효화한다. (20260819000002)
 */
function refresh() {
  for (const l of locales) {
    revalidatePath(`/${l}/changelog`);
    revalidatePath(`/${l}`);
  }
}

function readable(message: string): string {
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  return message;
}
