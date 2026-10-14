"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { fetchReleases, type FetchResult } from "@/lib/github";
import { locales } from "@/i18n/routing";

export type ReleaseInput = {
  id: string | null;
  productId: string;
  version: string;
  channel: "stable" | "beta";
  platform: string;
  assetUrl: string;
  fileSize: string;
  checksum: string;
  isLatest: boolean;
  releasedAt: string;
};

export type ActionResult = { ok: true } | { ok: false; message: string };

/** GitHub 에서 릴리스 목록을 읽어온다. 화면에서 어느 첨부파일을 쓸지 고른다. */
export async function importGithubReleases(repo: string): Promise<FetchResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };
  return fetchReleases(repo);
}

export async function saveRelease(input: ReleaseInput): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  if (!input.version.trim()) return { ok: false, message: "버전을 적어주세요." };
  if (!/^https?:\/\//.test(input.assetUrl.trim())) {
    return { ok: false, message: "파일 주소는 http(s) 로 시작해야 합니다." };
  }

  const row = {
    product_id: input.productId,
    version: input.version.trim(),
    channel: input.channel,
    platform: input.platform,
    asset_url: input.assetUrl.trim(),
    file_size: input.fileSize.trim() ? Number(input.fileSize) : null,
    checksum: input.checksum.trim() || null,
    is_latest: input.isLatest,
    released_at: input.releasedAt
      ? new Date(input.releasedAt).toISOString()
      : new Date().toISOString(),
  };

  const supabase = await createClient();

  // 제품·플랫폼당 최신은 하나뿐이다 (releases_one_latest 유니크 인덱스).
  // 새로 최신으로 지정하기 전에 기존 것을 내려야 인덱스 위반이 나지 않는다.
  if (row.is_latest) {
    const clear = await supabase
      .from("releases")
      .update({ is_latest: false })
      .eq("product_id", row.product_id)
      .eq("platform", row.platform)
      .eq("is_latest", true);
    if (clear.error) return { ok: false, message: readable(clear.error.message) };
  }

  const saved = input.id
    ? await supabase.from("releases").update(row).eq("id", input.id)
    : await supabase.from("releases").insert(row);

  if (saved.error) return { ok: false, message: readable(saved.error.message) };

  revalidatePublic();
  return { ok: true };
}

export async function deleteRelease(id: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "권한이 없습니다." };

  const supabase = await createClient();
  const { error } = await supabase.from("releases").delete().eq("id", id);
  if (error) return { ok: false, message: readable(error.message) };

  revalidatePublic();
  return { ok: true };
}

function revalidatePublic() {
  for (const l of locales) {
    revalidatePath(`/${l}`);
    revalidatePath(`/${l}/downloads`);
  }
}

function readable(message: string): string {
  if (message.includes("releases_product_id_version_platform_key")) {
    return "같은 버전과 플랫폼의 릴리스가 이미 있습니다.";
  }
  if (message.includes("releases_one_latest")) {
    return "이 플랫폼의 최신 릴리스가 이미 있습니다. 기존 것을 먼저 내려주세요.";
  }
  if (message.includes("releases_channel_known")) {
    return "채널은 stable 또는 beta 여야 합니다.";
  }
  if (message.includes("row-level security")) {
    return "권한이 없습니다. 다시 로그인해 보세요.";
  }
  return message;
}
