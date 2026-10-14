"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 네비게이션의 안 읽은 알림 수.
 *
 * 왜 클라이언트에서 세는가
 *   네비게이션은 모든 화면에 있다. 여기서 서버 쿠키를 읽으면 홈·제품 목록까지
 *   전부 요청마다 렌더되는 상태로 떨어진다.
 *   AuthButton·AdminOnly 가 클라이언트인 것과 같은 이유다.
 *   (lib/supabase/public.ts 주석, docs/HANDOFF.md "쿠키를 읽으면 정적 생성이 깨진다")
 *
 * 안 읽은 게 없으면 아무것도 그리지 않는다. 늘 0을 띄워두면
 * 0과 1을 구별하려고 매번 눈이 한 번 더 간다.
 *
 * 실제 차단은 RLS 가 한다. 여기를 뚫어도 남의 알림은 조회되지 않는다.
 */
export function NotificationBell() {
  const t = useTranslations();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setCount(0);
        return;
      }
      // 목록을 받아오지 않는다. 수만 필요하다.
      const { count: n } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .is("read_at", null);
      if (alive) setCount(n ?? 0);
    }

    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (count === 0) return null;

  return (
    <Link
      href="/me"
      aria-label={`${t("notif.title")} ${count}`}
      className="flex items-center gap-[6px] border border-amber px-[9px] py-[5px] font-mono text-[12px] text-amber transition-colors hover:bg-amber hover:text-on-amber"
    >
      <span className="size-[6px] bg-amber" aria-hidden />
      {count > 99 ? "99+" : count}
    </Link>
  );
}
