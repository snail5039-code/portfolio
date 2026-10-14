"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 네비 오른쪽의 로그인 / 내 서랍 버튼.
 *
 * 왜 클라이언트에서 세션을 읽는가
 *   네비는 모든 페이지의 레이아웃에 들어간다. 여기서 서버측으로 쿠키를 읽으면
 *   홈·소개·공지처럼 누구에게나 같은 페이지까지 전부 동적 렌더링으로 떨어진다.
 *   (그 문제를 lib/supabase/public.ts 로 한 번 고쳤다)
 *   로그인 여부는 껍데기만 바뀌는 정보라 브라우저에서 확인하는 편이 낫다.
 */
export function AuthButton() {
  const t = useTranslations();
  const locale = useLocale();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));

    // 다른 탭에서 로그인·로그아웃해도 따라오게 한다
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const cls =
    "border px-[14px] py-[7px] font-mono text-[12px] tracking-tag transition-colors";

  // 확인이 끝나기 전에는 자리만 잡아둔다. 로그인 버튼이 번쩍 나타났다
  // 사라지는 것보다 낫다.
  if (signedIn === null) {
    return (
      <span
        aria-hidden
        className={`${cls} border-transparent text-transparent select-none`}
      >
        {t("auth.signIn")}
      </span>
    );
  }

  if (!signedIn) {
    return (
      <Link
        href="/login"
        className={`${cls} border-edge text-mute hover:border-amber hover:text-amber`}
      >
        {t("auth.signIn")}
      </Link>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <Link
        href="/me"
        className={`${cls} border-edge text-mute hover:border-amber hover:text-amber`}
      >
        {t("nav.shelf")}
      </Link>
      {/* 로그아웃은 POST로만 받는다 — GET이면 남이 링크만 걸어도 로그아웃된다 */}
      <form action="/auth/signout" method="post">
        <input type="hidden" name="locale" value={locale} />
        <button
          type="submit"
          className="font-mono text-[12px] tracking-tag text-dim transition-colors hover:text-ink"
        >
          {t("auth.signOut")}
        </button>
      </form>
    </span>
  );
}
