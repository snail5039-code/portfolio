import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPublicClient } from "@/lib/supabase/public";
import { defaultLocale, locales } from "@/i18n/routing";

/**
 * 받기.
 *
 *   세션 확인 → 기록 → GitHub Releases 주소로 302
 *
 * 파일을 우리 서버로 흘려보내지 않는다. 리다이렉트만 한다.
 * 200MB 짜리를 프록시하면 Vercel 함수 실행 시간과 대역폭을 그대로 태운다.
 *
 * 알려진 한계
 *   asset_url 은 GitHub 의 공개 주소다. 그 주소를 직접 아는 사람은
 *   로그인 없이 받을 수 있다. 전부 무료인 지금은 수용한다.
 *   유료 제품이 생기면 그 제품만 Supabase Storage 로 옮기고
 *   여기서 만료되는 서명 URL 을 발급한다. 이 라우트의 주소는 그대로 둔다.
 *   (docs/ARCHITECTURE.md 4장)
 */

// 캐시하면 남의 다운로드가 내 기록으로 남는다
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> },
) {
  const { releaseId } = await params;
  const { origin } = new URL(request.url);
  const locale = pickLocale(request);

  // 공개 조회로 찾는다. RLS 가 발행된 제품의 릴리스만 돌려준다.
  const pub = createPublicClient();
  const { data, error } = await pub
    .from("releases")
    .select(
      `id, asset_url, version, product_id,
       products ( slug, requires_login, status )`,
    )
    .eq("id", releaseId)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.redirect(`${origin}/${locale}/products`, { status: 302 });
  }

  const release = data as unknown as {
    id: string;
    asset_url: string;
    product_id: string;
    products: { slug: string; requires_login: boolean; status: string } | null;
  };

  const product = release.products;
  if (!product || product.status !== "published") {
    return NextResponse.redirect(`${origin}/${locale}/products`, { status: 302 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && product.requires_login) {
    // 로그인 후 제품 화면으로 되돌린다. 받기를 다시 누르게 하는 편이
    // 자동으로 내려보내는 것보다 덜 놀랍다.
    const next = `/${locale}/products/${product.slug}`;
    return NextResponse.redirect(
      `${origin}/${locale}/login?next=${encodeURIComponent(next)}`,
      { status: 302 },
    );
  }

  if (user) {
    // 기록과 카운터를 한 트랜잭션으로 처리한다.
    // 같은 릴리스를 여러 번 받으면 기록은 매번, 카운터는 최초 1회만.
    const { error: recordError } = await supabase.rpc("record_download", {
      p_product_id: release.product_id,
      p_release_id: release.id,
      p_locale: locale,
    });

    // 기록에 실패해도 받는 것 자체는 막지 않는다.
    // 통계보다 사용자가 파일을 받는 게 중요하다.
    if (recordError) {
      console.error("[download] 기록 실패", recordError);
    }
  }

  return NextResponse.redirect(release.asset_url, { status: 302 });
}

/** next-intl 이 심어둔 쿠키에서 언어를 읽는다. */
function pickLocale(request: NextRequest): string {
  const fromQuery = request.nextUrl.searchParams.get("locale");
  const fromCookie = request.cookies.get("NEXT_LOCALE")?.value;
  for (const c of [fromQuery, fromCookie]) {
    if (c && (locales as readonly string[]).includes(c)) return c;
  }
  return defaultLocale;
}
