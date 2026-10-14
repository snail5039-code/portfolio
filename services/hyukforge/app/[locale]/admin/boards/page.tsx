import { Link } from "@/i18n/navigation";
import { listPosts } from "@/lib/queries/board";
import { BOARDS, STATE_KEY } from "@/lib/board";
import { shortDate } from "@/lib/format";

/**
 * 게시판 관리.
 *
 * 글을 고치는 건 글 상세에서 한다 — 상태·고정·숨김 버튼이 거기 붙어 있다.
 * 여기는 두 게시판을 한눈에 보고 손볼 글을 찾는 자리다.
 * 숨긴 글도 나온다 (RLS 가 관리자에게는 전부 돌려준다).
 */
export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = {
  open: "검토 중",
  planned: "만들 예정",
  inProgress: "만드는 중",
  done: "완료",
  declined: "반려",
};

export default async function AdminBoards() {
  // 언어 접두사는 i18n/navigation 의 Link 가 붙인다 — locale 을 받을 필요가 없다.
  const lists = await Promise.all(
    BOARDS.map(async (b) => ({ board: b, ...(await listPosts(b, 1, 200)) })),
  );

  return (
    <main className="pt-8">
      {lists.map(({ board, posts, total }) => (
        <section key={board} className="mb-12">
          <div className="mb-4 flex items-baseline gap-4">
            <h2 className="text-[19px] font-semibold">
              {board === "free" ? "자유게시판" : "요청 게시판"}
            </h2>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
            <span className="u-label">{total}건</span>
          </div>

          {posts.length === 0 ? (
            <p className="border-y border-line py-12 text-center text-[13.5px] text-dim">
              아직 글이 없습니다.
            </p>
          ) : (
            <ul className="border-t border-line">
              {posts.map((p) => (
                <li key={p.id} className="group border-b border-line">
                  <Link
                    href={`/board/${board}/${p.id}`}
                    className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-[13px] transition-colors group-hover:bg-panel"
                  >
                    {p.isPinned && (
                      <span className="font-mono text-[11px] tracking-tag text-amber">
                        고정
                      </span>
                    )}
                    {p.status === "hidden" && (
                      <span className="border border-dashed border-games px-2 py-[1px] font-mono text-[11px] text-games">
                        숨김
                      </span>
                    )}
                    {board === "request" && p.requestState && (
                      <span className="border border-edge px-2 py-[1px] font-mono text-[11px] text-mute">
                        {STATE_LABEL[STATE_KEY[p.requestState]]}
                      </span>
                    )}
                    <span className="text-[14.5px] text-ink">{p.title}</span>
                    <span className="ml-auto flex items-baseline gap-4 font-mono text-[12px] text-dim">
                      <span>댓글 {p.commentCount}</span>
                      {board === "request" && <span>공감 {p.voteCount}</span>}
                      <span>{p.author}</span>
                      <time dateTime={p.createdAt}>{shortDate(p.createdAt)}</time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="border-t border-line pt-5 text-[13px] text-dim">
        상태·고정·숨김은 글 상세에서 바꾼다.{" "}
        <Link href="/board/free" className="text-amber hover:underline">
          자유게시판 열기
        </Link>
      </p>
    </main>
  );
}
