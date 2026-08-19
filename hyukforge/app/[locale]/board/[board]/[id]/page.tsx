import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CommentSection } from "@/components/board/CommentSection";
import { PostControls } from "@/components/board/PostControls";
import { VoteButton } from "@/components/board/VoteButton";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";
import { shortDate } from "@/lib/format";
import { STATE_KEY, isBoard } from "@/lib/board";
import { getPost, hasVoted, listComments } from "@/lib/queries/board";

export const dynamic = "force-dynamic";

type Params = { locale: string; board: string; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id).catch(() => null);
  return post ? { title: post.title } : {};
}

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { locale, board, id } = await params;
  setRequestLocale(locale);
  if (!isBoard(board)) notFound();

  const t = await getTranslations();
  const post = await getPost(id).catch(() => null);

  // RLS 가 숨겨진 남의 글을 아예 돌려주지 않는다. 없는 것과 같게 다룬다.
  if (!post || post.board !== board) notFound();

  const [comments, voted, admin, supabase] = await Promise.all([
    listComments(id).catch(() => []),
    hasVoted(id).catch(() => false),
    isAdmin().catch(() => false),
    createClient(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <nav className="pb-6 pt-[52px] font-mono text-[12px] text-dim">
        <Link
          href={`/board/${board}`}
          className="transition-colors hover:text-amber"
        >
          ← {t(`board.${board}`)}
        </Link>
      </nav>

      <article className="max-w-[70ch]">
        <header className="border-b border-line pb-6">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {post.isPinned && (
              <span className="font-mono text-tag tracking-tag text-amber">
                {t("board.pinned")}
              </span>
            )}
            {board === "request" && post.requestState && (
              <span className="border border-edge px-2 py-[2px] font-mono text-tag tracking-tag text-mute">
                {t(`board.state.${STATE_KEY[post.requestState]}`)}
              </span>
            )}
            {post.status === "hidden" && (
              <span className="border border-dashed border-games px-2 py-[2px] font-mono text-tag tracking-tag text-games">
                비공개
              </span>
            )}
          </div>

          <h1 className="text-[24px] font-bold leading-[1.35] tracking-[-0.02em]">
            {post.title}
          </h1>

          <div className="mt-4 flex items-baseline gap-4 font-mono text-[12px] text-dim">
            <span className={post.isMine ? "text-mute" : undefined}>
              {post.isMine ? t("board.mine") : post.author}
            </span>
            <time dateTime={post.createdAt}>{shortDate(post.createdAt)}</time>
            <span>
              {t("board.comments")} {post.commentCount}
            </span>
          </div>
        </header>

        {/* 사용자 글은 마크다운으로 처리하지 않는다 — 줄바꿈만 그대로 살린다 */}
        <div className="whitespace-pre-wrap py-8 text-[15px] leading-[1.8] text-mute">
          {post.body}
        </div>

        {board === "request" && (
          <VoteButton
            postId={post.id}
            board={board}
            count={post.voteCount}
            voted={voted}
            signedIn={user != null}
          />
        )}

        <PostControls post={post} board={board} isAdmin={admin} />
      </article>

      <div className="max-w-[70ch]">
        <CommentSection
          postId={post.id}
          board={board}
          comments={comments}
          signedIn={user != null}
          isAdmin={admin}
        />
      </div>
    </main>
  );
}
