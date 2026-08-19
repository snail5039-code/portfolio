import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { pickTranslation } from "@/lib/queries/translation";
import { SpecRow } from "@/components/ui";
import { NicknameForm } from "@/components/me/NicknameForm";
import { DeleteAccount } from "@/components/me/DeleteAccount";
import { NotificationList } from "@/components/me/NotificationList";
import { listNotifications } from "@/lib/queries/notifications";
import { shortDate } from "@/lib/format";

/**
 * 내 서랍.
 *
 * 개인 페이지라 캐시하지 않는다. 세션을 읽으므로 요청마다 렌더된다.
 * 공개 페이지(홈·제품 목록 등)는 반대로 쿠키를 읽지 않아 정적으로 남는다.
 */
export const dynamic = "force-dynamic";

export default async function MyShelf({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 로그인하지 않았으면 로그인 화면으로. 끝나면 여기로 되돌아온다.
  if (!user) redirect(`/${locale}/login?next=/${locale}/me`);

  const t = await getTranslations();

  // 본인 프로필이라 기존 "프로필은 본인만" 정책으로 읽힌다.
  // nickname 컬럼이 아직 없는 환경(마이그레이션 전)에서는 조회가 실패하므로,
  // 화면 전체를 죽이지 않고 빈 값으로 넘긴다.
  const { data: profile } = await supabase
    .from("profiles")
    .select("nickname")
    .eq("id", user.id)
    .maybeSingle();
  const nickname = (profile as { nickname?: string | null } | null)?.nickname ?? null;

  const notifications = await listNotifications().catch(() => []);

  // RLS가 본인 것만 돌려준다
  const { data: downloads } = await supabase
    .from("downloads")
    .select(
      `id, created_at,
       products ( slug, product_translations ( locale, name ) ),
       releases ( version )`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (downloads ?? []) as unknown as {
    id: string;
    created_at: string;
    products: {
      slug: string;
      product_translations: { locale: string; name: string }[];
    } | null;
    releases: { version: string } | null;
  }[];

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t("nav.shelf")}
        </h1>
      </header>

      <div className="max-w-[62ch] pt-9">
        <div className="border-t border-line">
          <SpecRow label={t("auth.signedIn")}>{user.email}</SpecRow>
        </div>

        <NicknameForm userId={user.id} initial={nickname} />

        <NotificationList items={notifications} />

        <section className="pt-10">
          <div className="mb-5 flex items-baseline gap-4">
            <h2 className="text-[17px] font-semibold">
              {t("section.downloads")}
            </h2>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
          </div>

          {rows.length === 0 ? (
            <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
              {t("common.empty")}
            </p>
          ) : (
            <ul className="border-t border-line">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex items-baseline justify-between gap-4 border-b border-line py-3"
                >
                  <span className="text-[14px] text-ink">
                    {productName(r.products, locale)}
                  </span>
                  <span className="u-data">
                    {r.releases?.version ?? "—"} · {shortDate(r.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <DeleteAccount email={user.email ?? ""} locale={locale} />
      </div>
    </main>
  );
}

/**
 * 받은 제품의 이름. 다른 화면과 같은 폴백을 쓴다 (요청 언어 → en → ko).
 *
 * 번역이 하나도 없으면 slug 를 그대로 보여준다. 보관 처리된 제품은
 * RLS 가 번역을 돌려주지 않으므로 여기로 떨어진다 —
 * 받은 기록 자체는 남아 있어야 하니 행을 감추지는 않는다.
 */
function productName(
  product: {
    slug: string;
    product_translations: { locale: string; name: string }[];
  } | null,
  locale: string,
): string {
  if (!product) return "—";
  return pickTranslation(product.product_translations, locale)?.name ?? product.slug;
}
