import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { shortDate } from "@/lib/format";
import type { Notice } from "@/lib/queries/notices";

/**
 * 공지 목록.
 *
 * 번호 열을 두지 않는다. 흔한 게시판 관례지만 방문자에게 아무 의미가 없고,
 * 정렬이 바뀌면 번호가 흔들려서 오히려 헷갈린다.
 * 대신 날짜와 고정 표시만 둔다.
 */
export async function NoticesPage({ notices }: { notices: Notice[] }) {
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t("section.notices")}
        </h1>
      </header>

      {notices.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {t("common.empty")}
        </p>
      ) : (
        <ul className="border-t border-edge">
          {notices.map((n) => (
            <li key={n.id}>
              <Link
                href={`/notices/${n.slug}`}
                className="group grid items-baseline gap-[18px] border-b border-line py-[15px] transition-colors hover:bg-panel md:grid-cols-[1fr_104px]"
              >
                <span className="flex items-baseline gap-[10px]">
                  {n.isPinned && (
                    <span className="shrink-0 border border-amber px-[6px] py-[1px] font-mono text-[9px] tracking-tag text-amber">
                      {t("notice.pinned")}
                    </span>
                  )}
                  <span className="text-[15px] text-ink group-hover:text-amber">
                    {n.title}
                  </span>
                </span>
                <time
                  dateTime={n.publishedAt ?? undefined}
                  className="font-mono text-data text-dim md:text-right"
                >
                  {shortDate(n.publishedAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
