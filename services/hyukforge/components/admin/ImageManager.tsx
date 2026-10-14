"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import {
  addProductImage,
  deleteProductImage,
  moveProductImage,
} from "@/app/[locale]/admin/products/images";
import { MEDIA_BUCKET, imageUrl } from "@/lib/images";
import { Field, inputCls } from "./fields";

/**
 * 스크린샷 관리.
 *
 * 파일은 브라우저가 Storage 로 직접 올린다. 서버 액션을 거치면 5MB 를
 * 서버 메모리로 받았다가 다시 보내게 된다. 올릴 권한은 storage.objects 정책이
 * 관리자만으로 막고 있어서, 브라우저가 직접 올려도 남이 끼어들 수 없다.
 *
 * 올린 뒤에 product_images 에 줄을 남긴다. 파일만 있고 줄이 없으면 화면에
 * 안 나오고, 줄만 있고 파일이 없으면 깨진 이미지가 뜬다 — 그래서 실패하면
 * 올린 파일을 도로 지운다.
 *
 * 화면 문구는 한국어로 박아둔다 (app/[locale]/admin/layout.tsx 주석).
 */
export type ProductImage = {
  id: string;
  path: string;
  altKo: string | null;
  altEn: string | null;
};

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function ImageManager({
  productId,
  slug,
  images,
}: {
  productId: string;
  slug: string;
  images: ProductImage[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [altKo, setAltKo] = useState("");
  const [altEn, setAltEn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  async function upload(file: File) {
    setError(null);

    if (!TYPES.includes(file.type)) {
      setError("PNG · JPEG · WebP · AVIF 만 올릴 수 있습니다.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`5MB 까지만 올릴 수 있습니다. 지금 파일은 ${(file.size / 1048576).toFixed(1)}MB 입니다.`);
      return;
    }

    setBusy(true);
    const supabase = createClient();

    // 같은 이름을 다시 올려도 덮어쓰지 않게 시각을 붙인다
    const safe = file.name.replace(/[^\w.-]+/g, "-").toLowerCase();
    const path = `${slug}/${Date.now()}-${safe}`;

    const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
    });

    if (up.error) {
      setBusy(false);
      setError(`올리지 못했습니다 — ${up.error.message}`);
      return;
    }

    const res = await addProductImage({
      productId,
      storagePath: path,
      altKo,
      altEn,
    });

    if (!res.ok) {
      // 줄을 못 남겼으면 파일도 두지 않는다. 아무도 모르는 파일이 쌓인다.
      await supabase.storage.from(MEDIA_BUCKET).remove([path]);
      setBusy(false);
      setError(res.message);
      return;
    }

    setAltKo("");
    setAltEn("");
    if (fileRef.current) fileRef.current.value = "";
    setBusy(false);
    router.refresh();
  }

  function remove(img: ProductImage) {
    if (!confirm("이 스크린샷을 지웁니다. 되돌릴 수 없습니다.")) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteProductImage(img.id, img.path);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  function move(i: number, dir: -1 | 1) {
    const other = images[i + dir];
    if (!other) return;
    setError(null);
    startTransition(async () => {
      const res = await moveProductImage(images[i].id, other.id);
      if (!res.ok) setError(res.message);
      else router.refresh();
    });
  }

  const working = busy || pending;

  return (
    <section className="pt-12">
      <div className="mb-4 flex items-baseline gap-4">
        <h3 className="text-[17px] font-semibold">스크린샷</h3>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        <span className="u-label">{images.length}장</span>
      </div>

      {error && (
        <p className="mb-4 border border-games px-4 py-3 text-[13.5px] text-ink">
          {error}
        </p>
      )}

      {images.length > 0 && (
        <ul className="mb-6 space-y-3">
          {images.map((img, i) => (
            <li
              key={img.id}
              className="flex flex-wrap items-center gap-4 border border-edge p-3"
            >
              <Image
                src={imageUrl(img.path)}
                alt={img.altKo ?? ""}
                width={160}
                height={100}
                unoptimized
                className="h-[64px] w-[104px] border border-line object-cover"
              />
              <div className="min-w-[200px] flex-1">
                <p className="font-mono text-[12px] text-mute">
                  {i === 0 ? "대표 이미지" : `${i + 1}번째`}
                </p>
                <p className="truncate font-mono text-[11px] text-dim">{img.path}</p>
                {img.altKo && (
                  <p className="mt-1 text-[12px] text-mute">{img.altKo}</p>
                )}
              </div>
              <div className="flex gap-2 font-mono text-[12px]">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || working}
                  className="border border-edge px-3 py-[5px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1 || working}
                  className="border border-edge px-3 py-[5px] text-mute transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(img)}
                  disabled={working}
                  className="border border-edge px-3 py-[5px] text-dim transition-colors hover:border-games hover:text-games disabled:opacity-40"
                >
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-4 border border-edge p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="설명 (ko)" hint="화면을 못 보는 사람에게 읽어줄 문장">
            <input
              value={altKo}
              onChange={(e) => setAltKo(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="설명 (en)">
            <input
              value={altEn}
              onChange={(e) => setAltEn(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="파일" hint="PNG · JPEG · WebP · AVIF, 5MB 까지. 고르면 바로 올라간다">
          <input
            ref={fileRef}
            type="file"
            accept={TYPES.join(",")}
            disabled={working}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="block w-full font-mono text-[12px] text-mute file:mr-3 file:border file:border-edge file:bg-transparent file:px-4 file:py-[8px] file:font-mono file:text-[12px] file:text-ink hover:file:border-ink"
          />
        </Field>

        {busy && <p className="font-mono text-[12px] text-amber">올리는 중…</p>}
      </div>
    </section>
  );
}
