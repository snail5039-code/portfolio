"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 관리자에게만 보이는 조각. 공개 화면에 등록·수정 버튼을 얹는 데 쓴다.
 *
 * 왜 클라이언트에서 확인하는가
 *   공개 화면(홈·제품 목록·공지)은 정적으로 만들어 둔다. 서버에서 쿠키를 읽으면
 *   그 페이지가 전부 요청마다 렌더되는 상태로 떨어진다.
 *   (lib/supabase/public.ts 주석 참고)
 *
 * 이건 화면 편의 장치일 뿐이고 보안 장치가 아니다.
 * 실제 차단은 RLS 정책과 /admin 레이아웃의 권한 검사가 한다.
 * 여기를 뚫어도 쓰기는 막힌다.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setIsAdmin(false);
        return;
      }
      // RLS 가 본인 프로필만 돌려준다
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (alive) setIsAdmin((data as { role?: string } | null)?.role === "admin");
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!isAdmin) return null;
  return <>{children}</>;
}

/** 공개 화면에 얹는 관리자 링크. 앰버 점선으로 구분해 일반 UI와 섞이지 않게 한다. */
export function AdminLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <AdminOnly>
      <a
        href={href}
        className="border border-dashed border-amber px-3 py-[6px] font-mono text-[12px] tracking-tag text-amber transition-colors hover:bg-amber hover:text-on-amber"
      >
        {children}
      </a>
    </AdminOnly>
  );
}
