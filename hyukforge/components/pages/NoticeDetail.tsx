import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { shortDate } from "@/lib/format";
import type { Notice } from "@/lib/queries/notices";

export async function NoticeDetail({ notice: n }: { notice: Notice }) {
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <nav className="flex items-center gap-2 pb-6 pt-[52px] font-mono text-[12px] text-dim">
        <Link href="/notices" className="transition-colors hover:text-amber">
          {t("section.notices")}
        </Link>
        <span>/</span>
        <span className="text-mute">{n.title}</span>
      </nav>

      <article className="max-w-[68ch]">
        <header className="border-b border-edge pb-6">
          {n.isPinned && (
            <span className="mb-3 inline-block border border-amber px-[6px] py-[1px] font-mono text-[9px] tracking-tag text-amber">
              {t("notice.pinned")}
            </span>
          )}
          <h1 className="text-[26px] font-bold leading-[1.3] tracking-[-0.02em]">
            {n.title}
          </h1>
          <time
            dateTime={n.publishedAt ?? undefined}
            className="mt-3 block font-mono text-data text-dim"
          >
            {shortDate(n.publishedAt)}
          </time>
        </header>

        {/* 마크다운 렌더링은 나중에. 지금은 문단만 나눈다. */}
        <div className="space-y-4 pt-7 text-[15px] leading-[1.75] text-mute">
          {n.body.split("\n\n").map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </article>

      <p className="mt-12 border-t border-line pt-6">
        <Link
          href="/notices"
          className="font-mono text-[12px] text-dim transition-colors hover:text-amber"
        >
          ← {t("notice.backToList")}
        </Link>
      </p>
    </main>
  );
}
