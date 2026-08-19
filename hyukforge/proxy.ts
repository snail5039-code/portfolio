import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

/**
 * Next.js 16에서 `middleware.ts`가 `proxy.ts`로 바뀌었다.
 * next-intl 문서는 아직 middleware 기준이라 여기서 이름만 맞춰준다.
 *
 * 두 가지 일을 한다.
 *  1. 언어 감지·접두사 리다이렉트·언어 쿠키 (next-intl)
 *  2. 만료된 세션 토큰 갱신 (Supabase)
 */

const handleI18n = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  // 언어 처리를 먼저 한다. 리다이렉트가 나올 수 있는데 그 응답에도 쿠키를 붙여야 한다.
  const response = handleI18n(request);

  await refreshSession(request, response);

  return response;
}

/**
 * 세션 토큰 갱신. 이걸 빼면 토큰이 만료된 사용자가 로그아웃된 것처럼 보인다.
 *
 * 환경 변수가 없으면 조용히 건너뛴다.
 * 여기서 예외가 나면 matcher 를 타는 모든 경로가 500이 된다 —
 * 소개 글이나 공지처럼 로그인과 무관한 화면까지 같이 죽는다.
 * 설정이 빠진 것과 사이트가 통째로 내려가는 것은 다른 문제여야 한다.
 */
async function refreshSession(request: NextRequest, response: NextResponse) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // 배포 환경에 변수를 넣지 않은 경우다. 로그에 남겨 원인을 찾을 수 있게 한다.
    console.error(
      "[proxy] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY 가 없어 세션 갱신을 건너뜁니다.",
    );
    return;
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getSession() 이 아니라 getUser() 를 쓴다. 서버에서 믿을 수 있는 건 이쪽이다 —
    // getSession() 은 쿠키에 담긴 값을 검증 없이 돌려준다.
    await supabase.auth.getUser();
  } catch (error) {
    // 네트워크 문제나 Supabase 장애로 갱신이 실패해도 화면은 떠야 한다.
    console.error("[proxy] 세션 갱신 실패", error);
  }
}

export const config = {
  // 언어 처리를 타지 않을 경로
  // - _next        빌드 산출물
  // - api, auth    다운로드·인증 라우트 (언어 접두사가 붙으면 콜백 주소가 깨진다)
  // - brand, icon  로고·파비콘
  // - 확장자가 있는 경로는 전부 파일로 본다
  matcher: "/((?!api|auth|_next|brand|icon|.*\\..*).*)",
};
