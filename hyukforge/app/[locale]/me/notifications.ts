"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/routing";

/**
 * 알림 읽음 처리.
 *
 * 지우지 않고 read_at 만 채운다. 지우면 "아까 그 댓글 뭐였지" 를 다시 찾을 수 없다.
 * RLS 가 내 것만 고치게 막는다.
 */
export type ReadResult = { ok: true } | { ok: false };

export async function markRead(id: string): Promise<ReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .is("read_at", null);

  if (error) return { ok: false };
  refresh();
  return { ok: true };
}

export async function markAllRead(): Promise<ReadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) return { ok: false };
  refresh();
  return { ok: true };
}

function refresh() {
  for (const l of locales) revalidatePath(`/${l}/me`);
}
