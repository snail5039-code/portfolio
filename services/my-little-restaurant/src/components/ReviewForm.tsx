"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, ImagePlus, X } from "lucide-react";
import { createReview, type ActionState } from "@/app/restaurants/actions";
import { createClient } from "@/lib/supabase/client";
import OAuthLoginButton from "./OAuthLoginButton";

const initialState: ActionState = {};
const MAX_IMAGES = 4;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

export default function ReviewForm({
  restaurantId,
  isLoggedIn,
  userId,
}: {
  restaurantId: number | string;
  isLoggedIn: boolean;
  userId?: string | null;
}) {
  const [state, formAction] = useActionState(createReview, initialState);
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
        <p className="text-[13px] text-muted">리뷰는 로그인 후 남길 수 있어요.</p>
        <div className="flex gap-2">
          <OAuthLoginButton provider="kakao" size="sm" />
          <OAuthLoginButton provider="google" size="sm" />
        </div>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.some((f) => f.size > MAX_FILE_SIZE)) {
      setUploadError("사진은 파일당 8MB 이하만 첨부할 수 있어요.");
      return;
    }
    setUploadError(null);
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_IMAGES));
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setUploadError(null);

    startTransition(async () => {
      if (files.length > 0) {
        if (!userId) {
          setUploadError("로그인 정보를 확인하지 못했어요.");
          return;
        }
        setUploading(true);
        const supabase = createClient();
        for (const file of files) {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `reviews/${userId}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
          const { error } = await supabase.storage
            .from("restaurant-images")
            .upload(path, file);
          if (error) {
            setUploadError(`사진 업로드에 실패했어요: ${error.message}`);
            setUploading(false);
            return;
          }
          const { data } = supabase.storage
            .from("restaurant-images")
            .getPublicUrl(path);
          formData.append("image_urls", data.publicUrl);
        }
        setUploading(false);
      }
      formAction(formData);
      setFiles([]);
    });
  };

  const pending = isPending || uploading;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2.5 border-t border-line px-5 py-4"
    >
      <input type="hidden" name="restaurant_id" value={restaurantId} />

      <label className="flex items-center gap-2 text-[13px] text-muted">
        별점
        <select
          name="rating"
          defaultValue="5"
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-[13px] text-foreground outline-none focus:border-brand"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n}점
            </option>
          ))}
        </select>
      </label>

      <textarea
        name="content"
        rows={2}
        required
        placeholder="어떤 점이 좋았나요?"
        className="w-full resize-none rounded-md border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-brand"
      />

      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {previews.map((src, i) => (
            <div
              key={src}
              className="group relative h-16 w-16 overflow-hidden rounded-md border border-line"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 미리보기 */}
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label="사진 제거"
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      {files.length < MAX_IMAGES && (
        <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand">
          <ImagePlus className="h-3.5 w-3.5" />
          사진 추가
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      )}

      {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
      {state.error && <p className="text-xs text-red-500">{state.error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {uploading ? "업로드 중..." : "리뷰 남기기"}
        </button>
      </div>
    </form>
  );
}
