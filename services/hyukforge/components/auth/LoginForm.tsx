"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * 로그인 — Google 하나만 받는다.
 *
 * 비밀번호를 받지 않으니 유출될 비밀번호도 없고, 재설정 흐름도 만들 필요가 없다.
 * 이메일 매직 링크는 나중에 필요하면 여기에 더한다.
 */
export function LoginForm() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  // 콜백이 실패해서 되돌아온 경우
  const callbackError = params.get("error");
  const next = params.get("next") ?? `/${locale}`;

  async function withGoogle() {
    setPending(true);
    setFailed(false);

    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", next);
    url.searchParams.set("locale", locale);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: url.toString() },
    });

    // 성공하면 Google로 넘어가므로 이 아래는 실패했을 때만 실행된다
    if (error) {
      setPending(false);
      setFailed(true);
    }
  }

  return (
    <>
      {callbackError && (
        <p className="mb-6 border border-games px-4 py-3 text-[13px] text-ink">
          {t("auth.linkExpired")}
        </p>
      )}

      <button
        type="button"
        onClick={withGoogle}
        disabled={pending}
        className="w-full border border-amber bg-amber py-[13px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? t("auth.sending") : t("auth.withGoogle")}
      </button>

      {failed && (
        <p className="mt-4 text-[13px] text-games">{t("auth.failed")}</p>
      )}
    </>
  );
}
