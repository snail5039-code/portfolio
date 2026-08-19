import { createBrowserClient } from "@supabase/ssr";

/** 클라이언트 컴포넌트용. 로그인 버튼 등에서 쓴다. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
