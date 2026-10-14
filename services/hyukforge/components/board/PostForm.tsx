"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPost } from "@/app/[locale]/board/actions";
import type { BoardSlug } from "@/lib/board";

/**
 * 글쓰기.
 *
 * 제목과 내용만 받는다. 요청 상태·고정은 관리자만 바꿀 수 있으므로
 * 여기에 두지 않는다 — 보내봐야 RLS 와 트리거가 되돌린다.
 *
 * 작성 언어는 지금 보고 있는 화면 언어로 기록한다. 번역하지는 않지만
 * 나중에 목록에서 언어를 표시할 수 있다.
 */
export function PostForm({
  board,
  locale,
  signedIn,
}: {
  board: BoardSlug;
  locale: string;
  signedIn: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const ready = title.trim().length >= 2 && body.trim().length >= 2;

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createPost({ board, title, body, locale });
      if (!res.ok) {
        setError(t(`board.${res.code === "invalid" ? "failed" : res.code}`));
        return;
      }
      router.push(`/${locale}/board/${board}/${res.id}`);
      router.refresh();
    });
  }

  if (!signedIn) {
    return (
      <p className="border border-edge px-4 py-3 text-[13.5px] text-mute">
        {t("board.loginToWrite")}
      </p>
    );
  }

  return (
    <div className="max-w-[70ch]">
      {error && (
        <p className="mb-5 border border-games px-4 py-3 text-[13.5px] text-ink">
          {error}
        </p>
      )}

      <label className="block">
        <span className="u-label">{t("board.formTitle")}</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="mt-2 w-full border border-edge bg-panel px-3 py-[10px] text-[14px] text-ink outline-none focus:border-amber"
        />
      </label>

      <label className="mt-6 block">
        <span className="u-label">{t("board.formBody")}</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={20000}
          rows={14}
          className="mt-2 w-full resize-y border border-edge bg-panel px-3 py-[10px] text-[14px] leading-[1.7] text-ink outline-none focus:border-amber"
        />
        <span className="mt-1 block text-right font-mono text-[12px] text-dim">
          {body.length} / 20000
        </span>
      </label>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending}
          className="border border-amber bg-amber px-5 py-[11px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:border-amber-hi hover:bg-amber-hi disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-dim"
        >
          {pending ? t("board.submitting") : t("board.submit")}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={pending}
          className="border border-edge px-5 py-[11px] font-mono text-[12px] tracking-btn text-ink transition-colors hover:border-ink"
        >
          {t("board.cancel")}
        </button>
      </div>
    </div>
  );
}
