"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";

/**
 * 회원 권한·닉네임 손보기.
 *
 * 실제 차단은 함수 안에서 한다(admin_set_role 은 첫 줄이 is_admin() 검사다).
 * 그래도 여기서 한 번 더 본다 — 공지·제품 액션과 같은 규칙이다.
 * (app/[locale]/admin/notices/actions.ts)
 */
export type ActionResult = { ok: true } | { ok: false; message: string };

export type UserRole = "user" | "admin";

export async function setUserRole(
  userId: string,
  role: UserRole,
): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    target: userId,
    new_role: role,
  });

  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

export async function clearNickname(userId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_clear_nickname", {
    target: userId,
  });

  if (error) return { ok: false, message: readable(error.message) };
  return { ok: true };
}

/**
 * 함수가 던지는 메시지는 이미 한국어다(raise exception '권한이 없습니다.').
 * 그대로 내보내고, 사람이 읽을 수 없는 것만 바꿔 준다.
 */
function readable(message: string): string {
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  if (message.includes("does not exist") || message.includes("schema cache")) {
    return "회원 관리 함수가 아직 없습니다. 마이그레이션(20260921000001_admin_users)을 올려야 합니다.";
  }
  return message;
}
