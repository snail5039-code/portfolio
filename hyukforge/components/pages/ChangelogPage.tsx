import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Label } from "@/components/ui";
import { ChangelogList } from "@/components/home/ChangelogList";
import type { ChangelogEntry } from "@/lib/queries/changelog";

/**
 * 개발 기록 전체.
 *
 * 월별로 묶어서 낸다. 한 줄씩 이어 붙이면 얼마나 자주 손보는지가 안 보이는데,
 * 1인 스튜디오에서 그건 신뢰의 근거라 드러나야 한다.
 *
 * 옆 칸에서 달·제품으로 거른다 (ProductsPage의 분류 필터와 같은 방식 —
 * URL 쿼리로 걸어서 주소만으로 다시 찾아올 수 있다). 기본은 최신 달·전체
 * 제품이다. "전체 기간"을 고르면 쌓인 걸 전부 볼 수 있다.
 */
export async function ChangelogPage({
  entries,
  activeMonth,
  activeProduct,
}: {
  entries: ChangelogEntry[];
  /** 없으면 최신 달, "all"이면 전체 기간 */
  activeMonth?: string;
  /** 없거나 "all"이면 전체 제품 */
  activeProduct?: string;
}) {
  const t = await getTranslations();

  // 월별 건수 — entries가 최신순이라 Map도 최신 달이 먼저 온다
  const monthCounts = new Map<string, number>();
  for (const e of entries) {
    const key = e.date.slice(0, 7); // 2026-08
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const months = [...monthCounts];

  // 제품별 건수 — 처음 등장한 순서대로
  const productCounts = new Map<string, { name: string; count: number }>();
  for (const e of entries) {
    if (!e.productSlug) continue;
    const cur = productCounts.get(e.productSlug);
    if (cur) cur.count += 1;
    else productCounts.set(e.productSlug, { name: e.productName ?? e.productSlug, count: 1 });
  }
  const products = [...productCounts];

  const month =
    activeMonth === "all"
      ? null
      : activeMonth && monthCounts.has(activeMonth)
        ? activeMonth
        : (months[0]?.[0] ?? null);
  const product =
    activeProduct && activeProduct !== "all" && productCounts.has(activeProduct)
      ? activeProduct
      : null;

  const shown = entries.filter((e) => {
    if (month && e.date.slice(0, 7) !== month) return false;
    if (product && e.productSlug !== product) return false;
    return true;
  });

  // 필터를 바꿔도 다른 축은 그대로 둔다 — 달과 제품은 함께 걸 수 있다
  const href = (nextMonth: string | null, nextProduct: string | null) => {
    const p = new URLSearchParams();
    p.set("month", nextMonth ?? "all");
    p.set("product", nextProduct ?? "all");
    return `/changelog?${p.toString()}`;
  };

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t("section.changelog")}
        </h1>
        <p className="mt-2 max-w-[52ch] text-[14px] text-mute">
          {t("changelog.lead")}
        </p>
      </header>

      {months.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {t("common.empty")}
        </p>
      ) : (
        <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,68fr)_minmax(0,32fr)]">
          <div>
            <div className="mb-5 flex items-baseline gap-4">
              <h2 className="font-mono text-[13px] text-amber">
                {month ? month.replace("-", ".") : t("category.all")}
              </h2>
              <span className="-translate-y-[3px] flex-1 border-t border-line" />
              <span className="u-label">{t("changelog.count", { count: shown.length })}</span>
            </div>
            {shown.length === 0 ? (
              <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
                {t("common.empty")}
              </p>
            ) : (
              <ChangelogList entries={shown} />
            )}
          </div>

          <aside className="space-y-9">
            <div>
              <Label>{t("changelog.byMonth")}</Label>
              <nav className="mt-3">
                <FilterLink
                  href={href("all", product)}
                  label={t("category.all")}
                  count={entries.length}
                  on={month === null}
                />
                {months.map(([key, count]) => (
                  <FilterLink
                    key={key}
                    href={href(key, product)}
                    label={key.replace("-", ".")}
                    count={count}
                    on={month === key}
                  />
                ))}
              </nav>
            </div>

            <div>
              <Label>{t("changelog.byProduct")}</Label>
              <nav className="mt-3">
                <FilterLink
                  href={href(month, "all")}
                  label={t("category.all")}
                  count={entries.length}
                  on={product === null}
                />
                {products.map(([slug, p]) => (
                  <FilterLink
                    key={slug}
                    href={href(month, slug)}
                    label={p.name}
                    count={p.count}
                    on={product === slug}
                  />
                ))}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function FilterLink({
  href,
  label,
  count,
  on,
}: {
  href: string;
  label: string;
  count: number;
  on: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-3 border-b border-line py-[9px] font-mono text-[12.5px] transition-colors last:border-b-0 ${
        on ? "text-amber" : "text-mute hover:text-ink"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] text-dim">{count}</span>
    </Link>
  );
}
