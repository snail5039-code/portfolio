import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Btn, Label } from "@/components/ui";
import { SearchBox } from "@/components/search/SearchBox";
import { shortDate } from "@/lib/format";
import { BOARDS, STATE_KEY, type BoardSlug } from "@/lib/board";
import type { PostPage } from "@/lib/queries/board";

/**
 * 게시판 목록.
 *
 * 카드 그리드를 쓰지 않는다 — 균등한 카드 반복은 위계를 없앤다.
 * 제품 목록과 같은 표를 쓰고, 오른쪽에 댓글·공감 수를 모노스페이스로 붙인다.
 * (docs/DESIGN.md 1장)
 */
export async function BoardPage({
  board,
  result,
}: {
  board: BoardSlug;
  result: PostPage;
}) {
  const t = await getTranslations();
  const isRequest = board === "request";
  const { posts, total, page, pageCount, search } = result;

  // 쪽을 넘겨도 검색어가 풀리면 안 된다
  const href = (n: number) => {
    const p = new URLSearchParams();
    if (search) p.set("q", search);
    if (n > 1) p.set("page", String(n));
    const qs = p.toString();
    return qs ? `/board/${board}?${qs}` : `/board/${board}`;
  };

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t(`board.${board}`)}
        </h1>
        <p className="mt-3 max-w-[62ch] text-[14px] text-mute">
          {t(isRequest ? "board.requestLead" : "board.freeLead")}
        </p>
      </header>

      {/* 게시판 전환 + 글쓰기 */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-line py-4">
        <ul className="flex items-center gap-5">
          {BOARDS.map((b) => (
            <li key={b}>
              <Link
                href={`/board/${b}`}
                className={
                  b === board
                    ? "font-mono text-[12px] tracking-tag text-amber"
                    : "font-mono text-[12px] tracking-tag text-dim transition-colors hover:text-ink"
                }
              >
                {t(`board.${b}`)}
              </Link>
            </li>
          ))}
        </ul>

        <span className="ml-auto flex flex-wrap items-center gap-3">
          <SearchBox path={`/board/${board}`} initial={search} />
          <Btn href={`/board/${board}/new`}>{t("board.write")}</Btn>
        </span>
      </div>

      {posts.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {search ? t("board.searchNone") : t("board.empty")}
        </p>
      ) : (
        <ul>
          {posts.map((p) => (
            <li key={p.id} className="group border-b border-line">
              <Link
                href={`/board/${board}/${p.id}`}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-2 py-[15px] transition-colors group-hover:bg-panel"
              >
                {p.isPinned && (
                  <span className="font-mono text-tag tracking-tag text-amber">
                    {t("board.pinned")}
                  </span>
                )}

                {isRequest && p.requestState && (
                  <span className="border border-edge px-2 py-[2px] font-mono text-tag tracking-tag text-mute">
                    {t(`board.state.${STATE_KEY[p.requestState]}`)}
                  </span>
                )}

                <span className="text-[14.5px] text-ink">{p.title}</span>

                {p.commentCount > 0 && (
                  <span className="font-mono text-[12px] text-amber">
                    {p.commentCount}
                  </span>
                )}

                {p.status === "hidden" && (
                  <span className="font-mono text-tag tracking-tag text-dim">
                    비공개
                  </span>
                )}

                <span className="ml-auto flex items-baseline gap-4 font-mono text-[12px] text-dim">
                  {isRequest && (
                    <span>
                      {t("board.votes")} {p.voteCount}
                    </span>
                  )}
                  <span className={p.isMine ? "text-mute" : undefined}>
                    {p.isMine ? t("board.mine") : p.author}
                  </span>
                  <time dateTime={p.createdAt}>{shortDate(p.createdAt)}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav className="flex flex-wrap items-center justify-center gap-[6px] pt-8">
          {/* 쪽 번호를 다 늘어놓지 않는다. 지금 쪽 둘레와 양 끝만 낸다. */}
          {pageNumbers(page, pageCount).map((n, i) =>
            n === null ? (
              <span key={`gap-${i}`} className="px-2 font-mono text-[12px] text-dim">
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={
                  n === page
                    ? "border border-amber px-3 py-[6px] font-mono text-[12px] text-amber"
                    : "border border-edge px-3 py-[6px] font-mono text-[12px] text-mute transition-colors hover:border-ink hover:text-ink"
                }
              >
                {n}
              </Link>
            ),
          )}
        </nav>
      )}

      <p className="pt-6">
        <Label>
          {total} · {search ? t("board.searchFound") : t(`board.${board}`)}
        </Label>
      </p>
    </main>
  );
}

/**
 * 보여줄 쪽 번호. null 은 생략 표시(…) 자리다.
 * 쪽이 많아져도 버튼이 줄바꿈으로 쏟아지지 않게 앞뒤 한 칸씩만 낸다.
 */
function pageNumbers(page: number, pageCount: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let n = 1; n <= pageCount; n++) {
    const near = Math.abs(n - page) <= 1;
    const edge = n === 1 || n === pageCount;
    if (near || edge) out.push(n);
    else if (out[out.length - 1] !== null) out.push(null);
  }
  return out;
}
