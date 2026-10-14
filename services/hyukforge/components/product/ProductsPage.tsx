import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ProductTable } from "./ProductTable";
import { SearchBox } from "@/components/search/SearchBox";
import { categoryVar } from "@/lib/format";
import { AdminLink } from "@/components/admin/AdminOnly";
import type { CategorySlug, Product } from "@/lib/queries/products";

const CATEGORIES: CategorySlug[] = [
  "office",
  "games",
  "utilities",
  "webapps",
  "labs",
];

/**
 * 제품 목록.
 *
 * 분류를 카드 타일 5개로 늘어놓지 않고 필터 줄 하나로 낸다.
 * 이모지 타일은 성의 없어 보이고, 무엇보다 목록보다 자리를 더 차지한다.
 * (docs/DESIGN.md 1장)
 */
export async function ProductsPage({
  products,
  active,
  basePath = "/products",
  locale,
  search = "",
}: {
  products: Product[];
  active?: CategorySlug;
  basePath?: string;
  locale: string;
  /** 검색어. 목록은 이미 걸러진 채로 온다 — 여기서는 표시와 링크에만 쓴다 */
  search?: string;
}) {
  const t = await getTranslations();

  // 분류를 바꿔도 검색어가 풀리면 안 된다 (게시판의 쪽 넘기기와 같은 이유)
  const href = (category?: CategorySlug) => {
    const p = new URLSearchParams();
    if (category) p.set("category", category);
    if (search) p.set("q", search);
    const qs = p.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const counts = CATEGORIES.map((c) => ({
    slug: c,
    count: products.filter((p) => p.category === c).length,
  }));

  const shown = active
    ? products.filter((p) => p.category === active)
    : products;

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">
            {t("section.products")}
          </h1>
          {/* 관리자에게만 보인다 */}
          <span className="ml-auto flex gap-2">
            <AdminLink href={`/${locale}/admin/products/new`}>+ 새 제품</AdminLink>
            <AdminLink href={`/${locale}/admin`}>관리</AdminLink>
          </span>
        </div>
        <p className="mt-2 text-[14px] text-mute">{t("home.lead")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 py-6">
        <nav className="flex flex-wrap gap-[2px]">
          <FilterLink
            href={href()}
            label={t("category.all")}
            count={products.length}
            on={!active}
          />
          {counts.map(({ slug, count }) => (
            <FilterLink
              key={slug}
              href={href(slug)}
              label={t(`category.${slug}`)}
              count={count}
              on={active === slug}
              color={categoryVar[slug]}
            />
          ))}
        </nav>

        <span className="ml-auto">
          <SearchBox
            path={basePath}
            initial={search}
            keep={{ category: active }}
          />
        </span>
      </div>

      {search && shown.length === 0 ? (
        <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
          {t("search.none", { term: search })}
        </p>
      ) : (
        <ProductTable products={shown} />
      )}
    </main>
  );
}

function FilterLink({
  href,
  label,
  count,
  on,
  color,
}: {
  href: string;
  label: string;
  count: number;
  on: boolean;
  color?: string;
}) {
  return (
    <Link
      href={href}
      className={`border px-[15px] py-2 font-mono text-[12px] tracking-tag transition-colors ${
        on ? "border-edge text-ink" : "border-transparent text-dim hover:text-ink"
      }`}
      style={on && color ? { color: `var(${color})`, borderColor: `var(${color})` } : undefined}
    >
      {label}
      <sup className="ml-[5px] text-[9px] text-dim">{count}</sup>
    </Link>
  );
}
