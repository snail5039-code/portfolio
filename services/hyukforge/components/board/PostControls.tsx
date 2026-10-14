"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  deletePost,
  setPostFlags,
  setRequestState,
} from "@/app/[locale]/board/actions";
import {
  REQUEST_STATES,
  type BoardSlug,
  type Post,
  type RequestState,
} from "@/lib/board";

/** 관리자 조작 문구는 한국어로 박아둔다 — 쓰는 사람이 한 명이다. */
const STATE_LABEL: Record<RequestState, string> = {
  open: "검토 중",
  planned: "만들 예정",
  in_progress: "만드는 중",
  done: "완료",
  declined: "반려",
};

/**
 * 글 조작.
 *
 * 지우기는 본인·관리자, 상태·고정·숨김은 관리자만. 화면에서 감추는 건
 * 편의일 뿐이고 실제 차단은 RLS 정책과 posts_protect_admin_fields 트리거가 한다.
 */
export function PostControls({
  post,
  board,
  isAdmin,
}: {
  post: Post;
  board: BoardSlug;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canDelete = post.isMine || isAdmin;
  if (!canDelete && !isAdmin) return null;

  function run(fn: () => Promise<{ ok: boolean }>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(t("board.failed"));
        return;
      }
      if (after) after();
      else router.refresh();
    });
  }

  return (
    <div className="mt-8">
      {error && (
        <p className="mb-3 border border-games px-4 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}

      {canDelete && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm(t("board.deleteAsk"))) return;
            run(
              () => deletePost(post.id, board),
              () => {
                router.push(`/board/${board}`);
                router.refresh();
              },
            );
          }}
          className="border border-edge px-4 py-[8px] font-mono text-[12px] tracking-btn text-dim transition-colors hover:border-games hover:text-games"
        >
          {t("board.delete")}
        </button>
      )}

      {isAdmin && (
        <div className="mt-5 border border-dashed border-amber px-4 py-4">
          <p className="font-mono text-[11px] uppercase tracking-label text-amber">
            관리자
          </p>

          {board === "request" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {REQUEST_STATES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setRequestState(post.id, s, board))}
                  className={
                    post.requestState === s
                      ? "border border-amber px-3 py-[5px] font-mono text-[12px] text-amber"
                      : "border border-edge px-3 py-[5px] font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
                  }
                >
                  {STATE_LABEL[s]}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setPostFlags(post.id, { isPinned: !post.isPinned }, board))
              }
              className="border border-edge px-3 py-[5px] font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
            >
              {post.isPinned ? "고정 해제" : "맨 위 고정"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  setPostFlags(
                    post.id,
                    { status: post.status === "hidden" ? "published" : "hidden" },
                    board,
                  ),
                )
              }
              className="border border-edge px-3 py-[5px] font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
            >
              {post.status === "hidden" ? "다시 공개" : "숨기기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
