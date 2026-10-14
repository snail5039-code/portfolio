import { getTranslations } from "next-intl/server";
import { Section, SectionLink } from "@/components/ui";
import { Featured } from "@/components/product/Featured";
import { ProductTable } from "@/components/product/ProductTable";
import { Pager } from "@/components/Pager";
import { ChangelogList } from "./ChangelogList";
import { FeaturedCarousel } from "./FeaturedCarousel";
import { Hero } from "./Hero";
import { Stats } from "./Stats";
import type { Product, Stats as StatsData } from "@/lib/queries/products";
import type { ChangelogEntry } from "@/lib/queries/changelog";
import type { Notice } from "@/lib/queries/notices";

// 표 한 쪽에 보여줄 제품 수. 이보다 많아지면 페이지로 나눈다.
const PAGE_SIZE = 5;

const pad = (n: number) => String(n).padStart(2, "0");

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

  // 큰 자리에 먼저 걸리는 제품. 지정된 게 없으면 첫 번째를 쓴다.
  // 히어로도 이 제품의 스크린샷을 쓴다.
  const featured = products.find((p) => p.isFeatured) ?? products[0] ?? null;

  // 큰 자리는 돌아가며 쓴다 — 대표 제품이 먼저, 그다음은 목록 순서.
  // (listProducts 가 is_featured → 발행일 순으로 준다)
  const carousel = featured
    ? [featured, ...products.filter((p) => p.id !== featured.id)]
    : products;

  // 표가 아래로 계속 길어지는 대신 PAGE_SIZE개씩 페이지로 나눈다.
  const productPages: Product[][] = [];
  for (let i = 0; i < products.length; i += PAGE_SIZE) {
    productPages.push(products.slice(i, i + PAGE_SIZE));
  }

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
        {carousel.length > 0 && (
          <FeaturedCarousel
            names={carousel.map((p) => p.name)}
            labels={{ prev: t("home.prev"), next: t("home.next") }}
          >
            {carousel.map((p) => (
              <Featured
                key={p.id}
                product={p}
                // 히어로가 대표 제품의 첫 장을 이미 썼다. 두 장 이상 있으면
                // 다음 장을 쓴다 — 같은 화면에 같은 이미지가 두 번 걸리면
                // 스크린샷이 하나뿐인 것처럼 보인다
                shotIndex={
                  p.id === featured?.id && p.images.length > 1 ? 1 : 0
                }
              />
            ))}
          </FeaturedCarousel>
        )}
        {/* 큰 자리가 돌아가므로 표는 전체 목록이다. 하나를 빼두면
            그 제품만 표에서 사라진다. */}
        {productPages.length === 0 ? (
          <ProductTable products={[]} />
        ) : (
          <Pager
            index={productPages.map(
              (_, i) => `${pad(i + 1)} / ${pad(productPages.length)}`,
            )}
            labels={{ prev: t("product.prevPage"), next: t("product.nextPage") }}
          >
            {productPages.map((page, i) => (
              <ProductTable key={i} products={page} />
            ))}
          </Pager>
        )}
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
