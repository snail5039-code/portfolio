import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Label, SectionLink } from "@/components/ui";
import { shortDate } from "@/lib/format";
import type { Notice } from "@/lib/queries/notices";

/**
 * 홈 첫 화면의 공지.
 *
 * 공지는 사이트에 있는데 홈에는 들어갈 자리가 없었다. 제품·개발 기록은
 * 아래에 각자 자리가 있으니, 히어로 오른쪽은 공지에 준다.
 *
 * 스크린샷 자리를 대신하는 것이라 창 프레임(AppWindow)을 쓰지 않는다 —
 * 앱 화면이 아닌 것을 앱 창에 넣으면 그게 앱의 일부처럼 보인다.
 * 구분은 1px 선으로만 한다 (docs/DESIGN.md 4장).
 */
export async function NoticePanel({ notices }: { notices: Notice[] }) {
  const t = await getTranslations();

  return (
    <section className="border border-edge bg-panel">
      <div className="flex items-baseline gap-4 border-b border-line px-[18px] py-[13px]">
        <Label>{t("section.notices")}</Label>
        <span className="ml-auto">
          <SectionLink href="/notices">{t("common.viewAll")}</SectionLink>
        </span>
      </div>

      <ul>
        {notices.map((n) => (
          <li key={n.id} className="border-b border-line last:border-b-0">
            <Link
              href={`/notices/${n.slug}`}
              className="group block px-[18px] py-[15px] transition-colors hover:bg-bg"
            >
              <span className="flex items-baseline gap-[10px]">
                {n.isPinned && (
                  <span className="shrink-0 border border-amber px-[6px] py-[1px] font-mono text-[9px] tracking-tag text-amber">
                    {t("notice.pinned")}
                  </span>
                )}
                <span className="text-[15px] font-semibold text-ink transition-colors group-hover:text-amber">
                  {n.title}
                </span>
                <time
                  dateTime={n.publishedAt ?? undefined}
                  className="ml-auto shrink-0 font-mono text-data text-dim"
                >
                  {shortDate(n.publishedAt)}
                </time>
              </span>

              <span className="mt-[6px] block text-[13.5px] leading-[1.55] text-mute">
                {lead(n.body)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 본문 첫 문단만. 마크다운을 렌더하지 않는 자리라 문단 구분만 본다. */
function lead(body: string, max = 96): string {
  const first = body.split("\n\n")[0].replace(/\s+/g, " ").trim();
  return first.length > max ? `${first.slice(0, max)}…` : first;
}
