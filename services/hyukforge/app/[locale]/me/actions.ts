"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isNicknameShape } from "@/lib/board";
import { locales } from "@/i18n/routing";

/**
 * 닉네임 저장.
 *
 * 게시판에 이 이름으로 보인다. 비우면 지워지고 `#a3f19c` 형태로 돌아간다.
 * display_name(구글 실명)은 건드리지 않는다 — 그건 본인 확인용이고 공개되지 않는다.
 *
 * 오류는 코드로 돌려준다. 서버 액션은 요청 언어를 모른다.
 * (app/[locale]/board/actions.ts 와 같은 규칙)
 */
export type NicknameResult =
  | { ok: true; nickname: string | null }
  | { ok: false; code: "loginRequired" | "invalid" | "taken" | "failed" };

export async function setNickname(raw: string): Promise<NicknameResult> {
  const value = raw.trim();
  const next = value === "" ? null : value;

  if (next !== null && !isNicknameShape(next)) {
    return { ok: false, code: "invalid" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "loginRequired" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ nickname: next })
    .eq("id", user.id)
    .select("nickname")
    .maybeSingle();

  if (error) {
    // profiles_nickname_unique — 이미 쓰는 사람이 있다
    if (error.code === "23505" || error.message.includes("profiles_nickname_unique")) {
      return { ok: false, code: "taken" };
    }
    if (error.message.includes("profiles_nickname_shape")) {
      return { ok: false, code: "invalid" };
    }
    return { ok: false, code: "failed" };
  }

  // 쓰고 나서 읽어본다 — PostgREST 는 트리거가 값을 되돌려도 200 을 준다.
  // (docs/HANDOFF.md "쓰기는 쓰고 나서 읽어본다")
  const saved = (data as { nickname: string | null } | null)?.nickname ?? null;
  if (saved !== next) return { ok: false, code: "failed" };

  for (const l of locales) {
    revalidatePath(`/${l}/me`);
    revalidatePath(`/${l}/board/free`);
    revalidatePath(`/${l}/board/request`);
  }
  return { ok: true, nickname: saved };
}

/**
 * 탈퇴.
 *
 * auth.users 한 줄을 지우면 프로필·닉네임·다운로드 기록·게시글·댓글·공감이
 * 전부 함께 사라진다. 여섯 군데 외래키가 모두 on delete cascade 다.
 * 지우는 SQL 을 따로 쓰지 않는 이유이기도 하다 — 표가 늘 때마다 빠뜨리게 된다.
 *
 * service_role 키는 이 파일 밖으로 내보내지 않는다. "use server" 파일이라
 * 클라이언트 번들에 들어가지 않고, lib 에 두면 실수로 import 될 수 있다.
 *
 * 순서가 중요하다. 쿠키를 먼저 지우고 계정을 지운다.
 * 반대로 하면 계정이 사라진 채 로그인 상태로 남아 화면마다 오류가 난다.
 * 이 순서면 계정 삭제가 실패해도 로그아웃만 된 상태라 다시 들어오면 그만이다.
 */
export type DeleteResult =
  | { ok: true }
  | { ok: false; code: "loginRequired" | "mismatch" | "failed" };

export async function deleteAccount(confirmation: string): Promise<DeleteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "loginRequired" };

  // 화면에서도 확인하지만 여기서 한 번 더 본다.
  // 이메일을 그대로 받아적게 하는 건 실수로 누르는 걸 막으려는 것이다.
  if (confirmation.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return { ok: false, code: "mismatch" };
  }

  const id = user.id;
  await supabase.auth.signOut();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("[deleteAccount] 서버 키가 없습니다");
    return { ok: false, code: "failed" };
  }

  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    console.error("[deleteAccount] 삭제 실패", res.status, await res.text());
    return { ok: false, code: "failed" };
  }

  // 이 사람이 쓴 글이 목록에서 사라져야 한다
  for (const l of locales) {
    revalidatePath(`/${l}/board/free`);
    revalidatePath(`/${l}/board/request`);
  }
  return { ok: true };
}
