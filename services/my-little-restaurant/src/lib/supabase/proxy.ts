import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  /*
    Supabase 대시보드의 Redirect URLs에 /auth/callback 이 등록돼 있지 않으면
    OAuth 코드가 Site URL(보통 "/")로 떨어진다. 그 경우에도 로그인이 완료되도록
    /auth/callback 이외의 경로로 들어온 code 를 여기서 교환해준다.
  */
  const code = request.nextUrl.searchParams.get("code");
  if (code && !request.nextUrl.pathname.startsWith("/auth/callback")) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    const target = request.nextUrl.clone();
    target.searchParams.delete("code");
    target.searchParams.delete("state");
    if (error) {
      target.pathname = "/auth/auth-code-error";
    }

    const redirectResponse = NextResponse.redirect(target);
    // 교환 과정에서 심어진 세션 쿠키를 리다이렉트 응답으로 옮긴다.
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  // 세션 쿠키 갱신을 위해 호출만 해둔다. /mypage 등은 페이지 자체에서
  // 로그인 여부를 확인해 안내 UI를 보여주므로 여기서 리다이렉트하지 않는다.
  await supabase.auth.getClaims();

  return supabaseResponse;
}
