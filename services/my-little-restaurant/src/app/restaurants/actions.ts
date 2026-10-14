"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; success?: boolean };

export async function createRestaurant(
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

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "가게 이름을 입력해주세요." };
  }

  const categoryId = formData.get("category_id");
  const categoryName = String(formData.get("category_name") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const aloneOkRaw = formData.get("alone_ok");
  const memo = String(formData.get("memo") ?? "").trim();
  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  const { error } = await supabase.from("restaurants").insert({
    name,
    food: categoryName || "기타",
    category_id: categoryId ? Number(categoryId) : null,
    address: address || null,
    alone_ok: aloneOkRaw ? Number(aloneOkRaw) : null,
    memo: memo || null,
    latitude: latRaw ? Number(latRaw) : null,
    longitude: lngRaw ? Number(lngRaw) : null,
    image_url: imageUrl || null,
    user_id: user.id,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  return { success: true };
}

export async function updateRestaurant(
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

  const restaurantId = formData.get("restaurant_id");
  if (!restaurantId) {
    return { error: "잘못된 요청이에요." };
  }

  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { error: "가게 이름을 입력해주세요." };
  }

  const categoryId = formData.get("category_id");
  const categoryName = String(formData.get("category_name") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const aloneOkRaw = formData.get("alone_ok");
  const memo = String(formData.get("memo") ?? "").trim();
  const latRaw = formData.get("latitude");
  const lngRaw = formData.get("longitude");
  const imageUrl = String(formData.get("image_url") ?? "").trim();

  const { error } = await supabase
    .from("restaurants")
    .update({
      name,
      food: categoryName || "기타",
      category_id: categoryId ? Number(categoryId) : null,
      address: address || null,
      alone_ok: aloneOkRaw ? Number(aloneOkRaw) : null,
      memo: memo || null,
      latitude: latRaw ? Number(latRaw) : null,
      longitude: lngRaw ? Number(lngRaw) : null,
      image_url: imageUrl || null,
    })
    .eq("id", restaurantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}

export async function deleteRestaurant(restaurantId: number | string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { error } = await supabase
    .from("restaurants")
    .delete()
    .eq("id", restaurantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  revalidatePath("/mypage");
  return { success: true };
}

export async function updateMemo(restaurantId: number | string, memo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ memo: memo.trim() || null })
    .eq("id", restaurantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}

export async function toggleFavorite(restaurantId: number | string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("favorites").delete().eq("id", existing.id)
    : await supabase
        .from("favorites")
        .insert({ user_id: user.id, restaurant_id: Number(restaurantId) });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
  revalidatePath("/mypage");
  return { success: true, favorited: !existing };
}

export async function updateVisited(
  restaurantId: number | string,
  visited: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { error } = await supabase
    .from("restaurants")
    .update({ visited })
    .eq("id", restaurantId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
  revalidatePath("/mypage");
  return { success: true };
}

export async function createReview(
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

  const restaurantId = formData.get("restaurant_id");
  const content = String(formData.get("content") ?? "").trim();
  const ratingRaw = formData.get("rating");
  const imageUrls = formData
    .getAll("image_urls")
    .map((url) => String(url))
    .filter(Boolean);

  if (!restaurantId) {
    return { error: "잘못된 요청이에요." };
  }
  if (!content) {
    return { error: "리뷰 내용을 입력해주세요." };
  }
  if (!ratingRaw) {
    return { error: "별점을 선택해주세요." };
  }

  const { error } = await supabase.from("reviews").insert({
    restaurant_id: Number(restaurantId),
    user_id: user.id,
    rating: Number(ratingRaw),
    content,
    image_urls: imageUrls.length > 0 ? imageUrls : null,
  });

  if (error) {
    return { error: error.message };
  }

  // 리뷰 평균으로 restaurants.rating 갱신
  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("restaurant_id", restaurantId);

  const ratings = (reviews ?? [])
    .map((r) => r.rating)
    .filter((r): r is number => r !== null);
  if (ratings.length > 0) {
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    await supabase
      .from("restaurants")
      .update({ rating: Math.round(avg * 100) / 100 })
      .eq("id", restaurantId);
  }

  revalidatePath("/restaurants");
  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}

export async function createComment(
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

  const restaurantId = formData.get("restaurant_id");
  const content = String(formData.get("content") ?? "").trim();

  if (!restaurantId) {
    return { error: "잘못된 요청이에요." };
  }
  if (!content) {
    return { error: "댓글 내용을 입력해주세요." };
  }

  const { error } = await supabase.from("comments").insert({
    restaurant_id: Number(restaurantId),
    user_id: user.id,
    content,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}

export async function addMenuItem(
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

  const restaurantId = formData.get("restaurant_id");
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = formData.get("price");
  const isRepresentative = formData.get("is_representative") === "on";

  if (!restaurantId || !name) {
    return { error: "메뉴 이름을 입력해주세요." };
  }

  const { error } = await supabase.from("menu").insert({
    restaurant_id: Number(restaurantId),
    name,
    price: priceRaw ? Number(priceRaw) : null,
    is_representative: isRepresentative,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}

export async function deleteMenuItem(
  menuId: number | string,
  restaurantId: number | string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." };
  }

  const { error } = await supabase.from("menu").delete().eq("id", menuId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/restaurants/${restaurantId}`);
  return { success: true };
}
