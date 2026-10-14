import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale, locales } from "@/i18n/routing";

/**
 * 매직 링크와 OAuth가 돌아오는 자리.
 *
 * 언어 접두사 밖에 둔다 (/auth/callback). Supabase 대시보드에 등록하는 주소가
 * 언어마다 달라지면 10개를 다 등록해야 한다.
 * 돌아갈 곳은 next 파라미터로 받는다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const locale = pickLocale(searchParams.get("locale"));

  // 열린 리다이렉트를 막는다 — 우리 사이트 내부 경로만 허용한다.
  const raw = searchParams.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // 링크가 만료됐거나 이미 쓴 경우가 대부분이다
    return NextResponse.redirect(`${origin}/${locale}/login?error=exchange`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function pickLocale(value: string | null): string {
  return value && (locales as readonly string[]).includes(value)
    ? value
    : defaultLocale;
}
