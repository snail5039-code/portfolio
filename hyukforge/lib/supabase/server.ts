import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트·라우트 핸들러용 클라이언트.
 * 로그인한 사용자의 세션을 그대로 쓰므로 RLS가 적용된다.
 */
export async function createClient() {
  // Next.js 16에서 cookies()는 Promise다.
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts가 처리하므로 무시해도 된다.
          }
        },
      },
    },
  );
}
