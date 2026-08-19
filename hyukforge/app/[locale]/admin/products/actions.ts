"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { locales } from "@/i18n/routing";
import type { ProductDraft } from "@/lib/queries/admin";

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

/**
 * 제품 저장.
 *
 * RLS 가 이미 관리자만 쓰게 막고 있지만 여기서도 확인한다.
 * 정책에만 의존하면, 나중에 정책을 손댈 때 이 경로가 조용히 열린다.
 */
export async function saveProduct(draft: ProductDraft): Promise<SaveResult> {
  if (!(await isAdmin())) {
    return { ok: false, message: "권한이 없습니다." };
  }

  const slug = draft.slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/.test(slug)) {
    return {
      ok: false,
      message: "주소(slug)는 영문 소문자·숫자·하이픈만 쓸 수 있고 3자 이상이어야 합니다.",
    };
  }

  // 번역은 ko 와 en 을 요구한다. 나머지는 폴백으로 채워진다.
  // (docs/ARCHITECTURE.md 다국어 — 제품 설명은 ko+en 만 필수)
  for (const need of ["ko", "en"]) {
    if (!draft.translations[need]?.name?.trim()) {
      return { ok: false, message: `${need} 이름은 반드시 채워야 합니다.` };
    }
  }

  if (draft.kind === "webapp" && !draft.externalUrl.trim()) {
    return { ok: false, message: "웹앱은 열 주소(외부 URL)가 있어야 합니다." };
  }
  if (!draft.isFree && (!draft.priceKrw.trim() || !draft.checkoutUrl.trim())) {
    return { ok: false, message: "유료 제품은 가격과 결제 주소가 함께 있어야 합니다." };
  }

  // 발행 상태는 발행 시각이 있어야 한다 (DB 제약).
  // 비어 있으면 지금 시각으로 채운다 — 저장이 제약 위반으로 실패하는 것보다 낫다.
  let publishedAt: string | null = draft.publishedAt
    ? new Date(draft.publishedAt).toISOString()
    : null;
  if (draft.status === "published" && !publishedAt) {
    publishedAt = new Date().toISOString();
  }

  const nullable = (v: string) => (v.trim() === "" ? null : v.trim());

  const row = {
    slug,
    category_id: draft.categoryId,
    kind: draft.kind,
    status: draft.status,
    icon_letter: nullable(draft.iconLetter),
    platforms: draft.platforms,
    is_featured: draft.isFeatured,
    external_url: nullable(draft.externalUrl),
    github_repo: nullable(draft.githubRepo),
    source_url: nullable(draft.sourceUrl),
    demo_url: nullable(draft.demoUrl),
    video_url: nullable(draft.videoUrl),
    requires_login: draft.requiresLogin,
    is_free: draft.isFree,
    price_krw: draft.isFree ? null : Number(draft.priceKrw),
    checkout_url: draft.isFree ? null : nullable(draft.checkoutUrl),
    published_at: publishedAt,
  };

  const supabase = await createClient();

  const saved = draft.id
    ? await supabase.from("products").update(row).eq("id", draft.id).select("id").maybeSingle()
    : await supabase.from("products").insert(row).select("id").maybeSingle();

  if (saved.error) {
    return { ok: false, message: readableError(saved.error.message) };
  }
  const id = (saved.data as { id: string } | null)?.id;
  if (!id) {
    return { ok: false, message: "저장은 됐지만 결과를 읽지 못했습니다." };
  }

  // 번역 — 이름이 비어 있는 언어는 행을 만들지 않는다.
  // 빈 행이 있으면 번역 진행률이 부풀고, 폴백도 이름 유무로 판단하므로 헷갈린다.
  const rows = locales
    .filter((l) => draft.translations[l]?.name?.trim())
    .map((l) => {
      const t = draft.translations[l];
      return {
        product_id: id,
        locale: l,
        name: t.name.trim(),
        tagline: nullable(t.tagline),
        description: nullable(t.description),
        requirements: nullable(t.requirements),
        is_reviewed: t.isReviewed,
      };
    });

  if (rows.length) {
    const up = await supabase
      .from("product_translations")
      .upsert(rows, { onConflict: "product_id,locale" });
    if (up.error) return { ok: false, message: readableError(up.error.message) };
  }

  // 비워진 언어는 행을 지운다
  const keep = rows.map((r) => r.locale);
  const del = await supabase
    .from("product_translations")
    .delete()
    .eq("product_id", id)
    .not("locale", "in", `(${keep.length ? keep.join(",") : "''"})`);
  if (del.error) return { ok: false, message: readableError(del.error.message) };

  revalidatePublic();
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<SaveResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, message: readableError(error.message) };

  revalidatePublic();
  return { ok: true, id };
}

/** 정적으로 만들어둔 공개 화면을 다시 만들게 한다. */
function revalidatePublic() {
  for (const l of locales) {
    revalidatePath(`/${l}`);
    revalidatePath(`/${l}/downloads`);
    revalidatePath(`/${l}/changelog`);
  }
  // /products 와 /products/[slug] 는 요청마다 렌더되므로 무효화가 필요 없다
}

/** Postgres 오류 문구를 사람이 읽을 수 있게 바꾼다. */
function readableError(message: string): string {
  if (message.includes("products_slug_key")) {
    return "같은 주소(slug)를 쓰는 제품이 이미 있습니다.";
  }
  if (message.includes("products_webapp_needs_url")) {
    return "웹앱은 열 주소가 있어야 합니다.";
  }
  if (message.includes("products_published_needs_date")) {
    return "발행 상태에는 발행 시각이 필요합니다.";
  }
  if (message.includes("products_paid_needs_price")) {
    return "유료 제품은 가격과 결제 주소가 함께 있어야 합니다.";
  }
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  return message;
}
