"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ImagePlus, X } from "lucide-react";
import { createPost } from "@/app/board/actions";
import { CATEGORIES, type PostCategory } from "@/app/board/constants";
import type { ActionState } from "@/app/restaurants/actions";
import { createClient } from "@/lib/supabase/client";

const initialState: ActionState = {};

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

const FIELD_CLASS =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted";

export default function NewPostForm({
  isAdmin,
  userId,
}: {
  isAdmin: boolean;
  userId: string;
}) {
  const [state, formAction] = useActionState(createPost, initialState);
  const [isPending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  const previews = useMemo(
    () => files.map((file) => URL.createObjectURL(file)),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const selectableCategories: { value: PostCategory; label: string }[] =
    isAdmin ? [...CATEGORIES] : CATEGORIES.filter((c) => c.value !== "notice");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";

    const oversized = picked.some((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setUploadError("이미지는 파일당 8MB 이하만 첨부할 수 있어요.");
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
        setUploading(true);
        const supabase = createClient();
        for (const file of files) {
          const ext = file.name.split(".").pop() ?? "jpg";
          const path = `${userId}/${Math.random().toString(36).slice(2)}-${Date.now()}.${ext}`;
          const { error } = await supabase.storage
            .from("post-images")
            .upload(path, file);
          if (error) {
            setUploadError(`이미지 업로드에 실패했어요: ${error.message}`);
            setUploading(false);
            return;
          }
          const { data } = supabase.storage.from("post-images").getPublicUrl(path);
          formData.append("image_urls", data.publicUrl);
        }
        setUploading(false);
      }
      formAction(formData);
    });
  };

  const pending = isPending || uploading;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-5"
    >
      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>카테고리</span>
        <select name="category" required defaultValue="" className={FIELD_CLASS}>
          <option value="" disabled>
            선택해주세요
          </option>
          {selectableCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>제목</span>
        <input name="title" required className={FIELD_CLASS} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>내용</span>
        <textarea
          name="content"
          required
          rows={8}
          className={`${FIELD_CLASS} resize-none leading-relaxed`}
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={LABEL_CLASS}>사진 (선택, 최대 {MAX_IMAGES}장)</span>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div
                key={src}
                className="group relative h-20 w-20 overflow-hidden rounded-md border border-line"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 미리보기 */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label="이미지 제거"
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {files.length < MAX_IMAGES && (
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-brand hover:text-brand">
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
      </div>

      {uploadError && <p className="text-[13px] text-red-500">{uploadError}</p>}
      {state.error && <p className="text-[13px] text-red-500">{state.error}</p>}

      <div className="mt-1 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push("/board")}
          className="rounded-md px-3.5 py-2 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-muted"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {uploading ? "업로드 중..." : "등록하기"}
        </button>
      </div>
    </form>
  );
}
