import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * 공개 콘텐츠 조회용. 쿠키를 읽지 않는다.
 *
 * 왜 따로 두는가
 *   lib/supabase/server.ts 는 세션을 읽으려고 cookies() 를 부른다.
 *   Next.js 는 cookies() 를 쓴 라우트를 정적으로 만들 수 없어서,
 *   제품 목록처럼 누구에게나 같은 내용도 매 요청마다 DB를 때리게 된다.
 *   빌드 때는 아예 조회가 실패한다.
 *
 * 권한은 그대로다. anon 키를 쓰므로 RLS가 적용되고 발행된 것만 나온다.
 * is_admin() 은 언제나 false이므로, 관리자가 초안을 미리 보려면
 * 세션을 읽는 server.ts 쪽을 써야 한다.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
