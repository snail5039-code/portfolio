import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { shortDate } from "@/lib/format";
import type { ChangelogEntry } from "@/lib/queries/changelog";

/**
 * 개발 기록. 스톡 사진과 기술 스택 그리드가 있던 자리를 대신한다.
 * 날짜 + 제품 + 한 줄. 진짜 정보라 신뢰가 생긴다. (docs/DESIGN.md 1장)
 */
export async function ChangelogList({
  entries,
}: {
  entries: ChangelogEntry[];
}) {
  const t = await getTranslations();

  if (!entries.length) {
    return (
      <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
        {t("common.empty")}
      </p>
    );
  }

  return (
    <div className="border-t border-edge">
      {entries.map((e) => (
        <div
          key={e.id}
          className="grid items-baseline gap-[18px] border-b border-line py-[13px] md:grid-cols-[104px_140px_1fr]"
        >
          <time
            dateTime={e.date}
            className="font-mono text-data text-dim"
          >
            {shortDate(e.date)}
          </time>

          <span className="font-mono text-data text-mute">
            {e.productSlug ? (
              <Link
                href={`/products/${e.productSlug}`}
                className="transition-colors hover:text-amber"
              >
                {e.productName}
              </Link>
            ) : (
              "—"
            )}
          </span>

          <span className="text-[14px] text-ink">{e.body}</span>
        </div>
      ))}
    </div>
  );
}
