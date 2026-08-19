import { setRequestLocale } from "next-intl/server";
import { HomeSections } from "@/components/home/HomeSections";
import { listProducts, getStats } from "@/lib/queries/products";
import { listChangelog } from "@/lib/queries/changelog";
import { listNotices } from "@/lib/queries/notices";
import { EMPTY_STATS, orEmpty } from "@/lib/queries/safe";

// 제품 정보는 자주 바뀌지 않는다. 관리자가 저장하면 revalidatePath로 무효화한다.
export const revalidate = 300;

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // DB가 잠들어 있거나 마이그레이션이 덜 올라갔어도 화면은 뜬다.
  // 실패는 서버 로그에 남는다.
  const [products, stats, changelog, notices] = await Promise.all([
    listProducts(locale, { limit: 8 }).catch(orEmpty([], "products")),
    getStats().catch(orEmpty(EMPTY_STATS, "stats")),
    listChangelog(locale, 5).catch(orEmpty([], "changelog")),
    // 첫 화면에 세 건까지. 고정 공지가 맨 위로 온다 (listNotices 의 정렬)
    listNotices(locale, 3).catch(orEmpty([], "notices")),
  ]);

  return (
    <HomeSections
      products={products}
      stats={stats}
      changelog={changelog}
      notices={notices}
    />
  );
}
