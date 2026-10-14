"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createComment, deleteComment } from "@/app/[locale]/board/actions";
import { shortDate } from "@/lib/format";
import type { BoardSlug, Comment } from "@/lib/board";

/** 댓글 목록 + 입력. 삭제는 본인 것과 관리자만 보인다(RLS 가 실제로 막는다). */
export function CommentSection({
  postId,
  board,
  comments,
  signedIn,
  isAdmin,
}: {
  postId: string;
  board: BoardSlug;
  comments: Comment[];
  signedIn: boolean;
  isAdmin: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    startTransition(async () => {
      const res = await createComment(postId, board, body);
      if (!res.ok) {
        setError(t(`board.${res.code === "invalid" ? "failed" : res.code}`));
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm(t("board.deleteCommentAsk"))) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteComment(id, postId, board);
      if (!res.ok) setError(t("board.failed"));
      else router.refresh();
    });
  }

  return (
    <section className="pt-[68px]">
      <div className="mb-5 flex items-baseline gap-4">
        <h2 className="text-[17px] font-semibold">{t("board.comments")}</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        <span className="u-label">{comments.length}</span>
      </div>

      {error && (
        <p className="mb-4 border border-games px-4 py-3 text-[13.5px] text-ink">
          {error}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
          {t("board.commentEmpty")}
        </p>
      ) : (
        <ul className="border-t border-line">
          {comments.map((c) => (
            <li key={c.id} className="border-b border-line py-[14px]">
              <div className="flex items-baseline gap-3 font-mono text-[12px] text-dim">
                <span className={c.isMine ? "text-mute" : undefined}>
                  {c.isMine ? t("board.mine") : c.author}
                </span>
                <time dateTime={c.createdAt}>{shortDate(c.createdAt)}</time>
                {(c.isMine || isAdmin) && (
                  <button
                    type="button"
                    onClick={() => remove(c.id)}
                    disabled={pending}
                    className="ml-auto text-dim transition-colors hover:text-games"
                  >
                    {t("board.delete")}
                  </button>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[14px] leading-[1.75] text-mute">
                {c.body}
              </p>
            </li>
          ))}
        </ul>
      )}

      {signedIn ? (
        <div className="mt-6 max-w-[70ch]">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            rows={4}
            className="w-full resize-y border border-edge bg-panel px-3 py-[10px] text-[14px] leading-[1.7] text-ink outline-none focus:border-amber"
          />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={add}
              disabled={!body.trim() || pending}
              className="border border-edge px-5 py-[9px] font-mono text-[12px] tracking-btn text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-dim"
            >
              {pending ? t("board.submitting") : t("board.submit")}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-6 border border-edge px-4 py-3 text-[13.5px] text-mute">
          {t("board.loginToComment")}
        </p>
      )}
    </section>
  );
}
