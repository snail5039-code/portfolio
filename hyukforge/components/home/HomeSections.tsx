import { getTranslations } from "next-intl/server";
import { Section, SectionLink } from "@/components/ui";
import { Featured } from "@/components/product/Featured";
import { ProductTable } from "@/components/product/ProductTable";
import { ChangelogList } from "./ChangelogList";
import { Hero } from "./Hero";
import { Stats } from "./Stats";
import type { Product, Stats as StatsData } from "@/lib/queries/products";
import type { ChangelogEntry } from "@/lib/queries/changelog";
import type { Notice } from "@/lib/queries/notices";

/**
 * 홈 화면 본문.
 *
 * 데이터를 인자로 받는다. 그래야 실제 DB(app/[locale]/page.tsx)와
 * 디자인 확인용 예시(app/[locale]/preview)가 같은 화면을 공유한다.
 */
export async function HomeSections({
  products,
  stats,
  changelog,
  notices = [],
}: {
  products: Product[];
  stats: StatsData;
  changelog: ChangelogEntry[];
  notices?: Notice[];
}) {
  const t = await getTranslations();

  // 대표 제품 하나를 크게 띄우고 나머지는 표로. 지정된 게 없으면 첫 번째를 쓴다.
  const featured = products.find((p) => p.isFeatured) ?? products[0] ?? null;
  const rest = featured ? products.filter((p) => p.id !== featured.id) : products;

  return (
    <main className="mx-auto max-w-page px-gutter">
      {/* 공지가 있으면 공지, 없으면 대표 제품 스크린샷 (Hero 주석 참고) */}
      <Hero product={featured} notices={notices} />
      <Stats data={stats} />

      <Section
        title={t("section.products")}
        action={
          <SectionLink href="/products">
            {t("common.viewAll")} {products.length > 0 && `(${products.length})`}
          </SectionLink>
        }
      >
        {/* 히어로가 첫 장을 이미 썼다. 두 장 이상 있으면 다음 장을 쓴다 —
            같은 화면에 같은 이미지가 두 번 걸리면 스크린샷이 하나뿐인 것처럼 보인다 */}
        {featured && (
          <Featured
            product={featured}
            shotIndex={featured.images.length > 1 ? 1 : 0}
          />
        )}
        <ProductTable products={rest} />
      </Section>

      <Section
        title={t("section.changelog")}
        action={
          <SectionLink href="/changelog">{t("common.viewAll")}</SectionLink>
        }
      >
        <ChangelogList entries={changelog} />
      </Section>
    </main>
  );
}
