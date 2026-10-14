"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { MEDIA_BUCKET } from "@/lib/images";
import { locales } from "@/i18n/routing";

/**
 * 제품 스크린샷.
 *
 * 파일 자체는 브라우저가 Storage 로 직접 올린다 — 서버 액션을 거치면
 * 5MB 를 서버 메모리로 한 번 받았다가 다시 보내게 된다.
 * 올릴 권한은 storage.objects 정책이 관리자만으로 막고 있다 (20260819000004).
 *
 * 여기서는 올린 뒤의 뒷정리만 한다. product_images 에 줄을 남기고,
 * 지울 때는 표와 파일을 함께 지운다.
 */
export type ImgResult = { ok: true } | { ok: false; message: string };

export async function addProductImage(input: {
  productId: string;
  storagePath: string;
  altKo: string;
  altEn: string;
}): Promise<ImgResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();

  // 맨 뒤에 붙인다
  const { data: last } = await supabase
    .from("product_images")
    .select("sort_order")
    .eq("product_id", input.productId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const next = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  const { error } = await supabase.from("product_images").insert({
    product_id: input.productId,
    storage_path: input.storagePath,
    alt_ko: input.altKo.trim() || null,
    alt_en: input.altEn.trim() || null,
    sort_order: next,
  });

  if (error) return { ok: false, message: readable(error.message) };

  refresh();
  return { ok: true };
}

export async function deleteProductImage(
  id: string,
  storagePath: string,
): Promise<ImgResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();

  // 표를 먼저 지운다. 파일이 남는 건 눈에 안 띄지만, 표만 남으면 깨진 이미지가 뜬다.
  const { error } = await supabase.from("product_images").delete().eq("id", id);
  if (error) return { ok: false, message: readable(error.message) };

  const { error: fileError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([storagePath]);

  // 파일 삭제가 실패해도 화면은 이미 정상이다. 고아 파일만 남는다.
  if (fileError) console.error("[images] 파일 삭제 실패", storagePath, fileError);

  refresh();
  return { ok: true };
}

/** 순서 바꾸기. 목록에서 위아래로 한 칸씩 옮긴다. */
export async function moveProductImage(
  id: string,
  otherId: string,
): Promise<ImgResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_images")
    .select("id, sort_order")
    .in("id", [id, otherId]);

  if (error) return { ok: false, message: readable(error.message) };
  const rows = data as { id: string; sort_order: number }[];
  if (rows.length !== 2) return { ok: false, message: "옮길 대상을 찾지 못했습니다." };

  const a = rows.find((r) => r.id === id)!;
  const b = rows.find((r) => r.id === otherId)!;

  // 값을 맞바꾼다. sort_order 에 유니크 제약이 없어 중간값을 거치지 않아도 된다.
  const first = await supabase
    .from("product_images")
    .update({ sort_order: b.sort_order })
    .eq("id", a.id);
  if (first.error) return { ok: false, message: readable(first.error.message) };

  const second = await supabase
    .from("product_images")
    .update({ sort_order: a.sort_order })
    .eq("id", b.id);
  if (second.error) return { ok: false, message: readable(second.error.message) };

  refresh();
  return { ok: true };
}

function refresh() {
  for (const l of locales) {
    revalidatePath(`/${l}`);
    revalidatePath(`/${l}/products/[slug]`, "page");
  }
}

function readable(message: string): string {
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  return message;
}
