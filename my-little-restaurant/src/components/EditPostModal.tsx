"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Pencil, X, Loader2, ImagePlus } from "lucide-react";
import { updatePost } from "@/app/board/actions";
import { CATEGORIES, type PostCategory } from "@/app/board/constants";
import type { ActionState } from "@/app/restaurants/actions";
import { createClient } from "@/lib/supabase/client";

const FIELD_CLASS =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand";
const LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wide text-muted";
const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

export default function EditPostModal({
  postId,
  userId,
  isAdmin,
  category,
  title,
  content,
  imageUrls,
}: {
  postId: number | string;
  userId: string;
  isAdmin: boolean;
  category: PostCategory;
  title: string;
  content: string;
  imageUrls: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [isPending, startTransition] = useTransition();
  const [existingUrls, setExistingUrls] = useState<string[]>(imageUrls);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const selectableCategories = isAdmin
    ? [...CATEGORIES]
    : CATEGORIES.filter((c) => c.value !== "notice" || c.value === category);

  const newPreviews = useMemo(
    () => newFiles.map((file) => URL.createObjectURL(file)),
    [newFiles],
  );
  useEffect(() => {
    return () => newPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [newPreviews]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    setState({});
    setUploadError(null);
  };

  const totalCount = existingUrls.length + newFiles.length;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";

    const oversized = picked.some((f) => f.size > MAX_FILE_SIZE);
    if (oversized) {
      setUploadError("이미지는 파일당 8MB 이하만 첨부할 수 있어요.");
      return;
    }
    setUploadError(null);
    setNewFiles((prev) => [...prev, ...picked].slice(0, MAX_IMAGES - existingUrls.length));
  };

  const removeExisting = (url: string) => {
    setExistingUrls((prev) => prev.filter((u) => u !== url));
  };

  const removeNewFile = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (formData: FormData) => {
    setUploadError(null);
    startTransition(async () => {
      const finalUrls = [...existingUrls];

      if (newFiles.length > 0) {
        setUploading(true);
        const supabase = createClient();
        for (const file of newFiles) {
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
          finalUrls.push(data.publicUrl);
        }
        setUploading(false);
      }

      formData.delete("image_urls");
      finalUrls.forEach((url) => formData.append("image_urls", url));

      const result = await updatePost({}, formData);
      setState(result);
      if (result.success) {
        setOpen(false);
      }
    });
  };

  const pending = isPending || uploading;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-brand"
      >
        <Pencil className="h-3.5 w-3.5" />
        수정
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 p-4 sm:items-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-post-title"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="my-auto w-full max-w-lg overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 id="edit-post-title" className="text-[15px] font-bold text-foreground">
                글 수정
              </h2>
              <button
                onClick={close}
                aria-label="닫기"
                className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={handleSubmit} className="flex flex-col gap-3.5 p-5">
              <input type="hidden" name="post_id" value={postId} />

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>카테고리</span>
                <select
                  name="category"
                  required
                  defaultValue={category}
                  className={FIELD_CLASS}
                >
                  {selectableCategories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>제목</span>
                <input
                  name="title"
                  required
                  autoFocus
                  defaultValue={title}
                  className={FIELD_CLASS}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>내용</span>
                <textarea
                  name="content"
                  required
                  rows={8}
                  defaultValue={content}
                  className={`${FIELD_CLASS} resize-none leading-relaxed`}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <span className={LABEL_CLASS}>사진 (선택, 최대 {MAX_IMAGES}장)</span>
                {(existingUrls.length > 0 || newPreviews.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {existingUrls.map((url) => (
                      <div
                        key={url}
                        className="group relative h-20 w-20 overflow-hidden rounded-md border border-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase Storage 공개 URL */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeExisting(url)}
                          aria-label="이미지 제거"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {newPreviews.map((src, i) => (
                      <div
                        key={src}
                        className="group relative h-20 w-20 overflow-hidden rounded-md border border-line"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- 업로드 전 로컬 미리보기 */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNewFile(i)}
                          aria-label="이미지 제거"
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {totalCount < MAX_IMAGES && (
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
                {uploadError && (
                  <span className="text-[11px] text-red-500">{uploadError}</span>
                )}
              </div>

              {state.error && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                  {state.error}
                </p>
              )}

              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={close}
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
                  {uploading ? "업로드 중..." : "저장하기"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
