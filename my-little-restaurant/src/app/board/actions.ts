"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/app/restaurants/actions";
import { CATEGORIES } from "./constants";

export async function createPost(
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

  const category = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const imageUrls = formData
    .getAll("image_urls")
    .map((url) => String(url))
    .filter(Boolean);

  if (!CATEGORIES.some((c) => c.value === category)) {
    return { error: "카테고리를 선택해주세요." };
  }
  if (!title) {
    return { error: "제목을 입력해주세요." };
  }
  if (!content) {
    return { error: "내용을 입력해주세요." };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      category,
      title,
      content,
      user_id: user.id,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    })
    .select("id")
    .single();

  if (error) {
    // RLS에 막히면(공지사항인데 관리자가 아닌 경우) 여기로 떨어진다.
    return { error: "작성 권한이 없거나 저장에 실패했어요." };
  }

  revalidatePath("/board");
  redirect(`/board/${data.id}`);
}

export async function updatePost(
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

  const postId = formData.get("post_id");
  const category = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const imageUrls = formData
    .getAll("image_urls")
    .map((url) => String(url))
    .filter(Boolean);

  if (!postId) {
    return { error: "잘못된 요청이에요." };
  }
  if (!CATEGORIES.some((c) => c.value === category)) {
    return { error: "카테고리를 선택해주세요." };
  }
  if (!title) {
    return { error: "제목을 입력해주세요." };
  }
  if (!content) {
    return { error: "내용을 입력해주세요." };
  }

  const { error } = await supabase
    .from("posts")
    .update({
      category,
      title,
      content,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
    })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "수정 권한이 없거나 저장에 실패했어요." };
  }

  revalidatePath("/board");
  revalidatePath(`/board/${postId}`);
  return { success: true };
}

export async function deletePost(postId: number | string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { error } = await supabase.from("posts").delete().eq("id", postId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/board");
  redirect("/board");
}
