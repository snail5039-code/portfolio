import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/LoginForm";

/**
 * 로그인 화면.
 *
 * 폼은 클라이언트 컴포넌트다 (LoginForm). 여기서는 문구와 틀만 잡는다.
 */
export async function LoginPage() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex max-w-page justify-center px-gutter pb-24 pt-[92px]">
      <div className="w-full max-w-[380px]">
        <h1 className="text-[24px] font-bold tracking-[-0.02em]">
          {t("auth.signIn")}
        </h1>
        <p className="mt-3 text-[13.5px] text-mute">{t("home.privacyNote")}</p>

        <div className="mt-8">
          {/* useSearchParams를 쓰므로 Suspense로 감싼다 */}
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 border-l border-edge pl-3 text-[13px] text-dim">
          {t("auth.noPassword")}
        </p>
      </div>
    </main>
  );
}
