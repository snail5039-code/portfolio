"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/restaurants/actions";

export async function updateProfile(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const nickname = String(formData.get("nickname") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!nickname) {
    return { error: "닉네임을 입력해주세요." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname, phone: phone || null })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/mypage");
  return { success: true };
}
