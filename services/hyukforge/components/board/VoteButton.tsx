"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toggleVote } from "@/app/[locale]/board/actions";
import type { BoardSlug } from "@/lib/board";

/**
 * 공감.
 *
 * 누른 즉시 화면을 바꾸고 서버 응답으로 바로잡는다. 왕복을 기다리면
 * 두 번 눌러 중복 오류를 내기 쉽다.
 * 정본은 posts.vote_count 이고, 그 값은 트리거가 센다.
 */
export function VoteButton({
  postId,
  board,
  count,
  voted,
  signedIn,
}: {
  postId: string;
  board: BoardSlug;
  count: number;
  voted: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [on, setOn] = useState(voted);
  const [n, setN] = useState(count);
  const [pending, startTransition] = useTransition();

  function click() {
    if (!signedIn) return;
    const next = !on;
    setOn(next);
    setN((v) => v + (next ? 1 : -1));

    startTransition(async () => {
      const res = await toggleVote(postId, board);
      if (!res.ok) {
        // 되돌린다 — 낙관적으로 바꾼 화면이 사실과 어긋난 채로 남으면 안 된다
        setOn(!next);
        setN((v) => v + (next ? -1 : 1));
        return;
      }
      if (res.voted !== undefined) setOn(res.voted);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={click}
        disabled={!signedIn || pending}
        title={signedIn ? undefined : t("board.loginToVote")}
        className={
          on
            ? "border border-amber px-4 py-[9px] font-mono text-[12px] tracking-btn text-amber transition-colors hover:bg-amber hover:text-on-amber disabled:cursor-not-allowed"
            : "border border-edge px-4 py-[9px] font-mono text-[12px] tracking-btn text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-dim"
        }
      >
        {on ? t("board.unvote") : t("board.vote")} {n}
      </button>
      {!signedIn && (
        <span className="text-[13px] text-dim">{t("board.loginToVote")}</span>
      )}
    </div>
  );
}
