import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useTranslation } from "react-i18next";

/**
 * OAuth2 로그인 완료 후 백엔드가 넘겨준 accessToken을 받아서
 * AuthProvider(user)까지 바로 갱신 → 새로고침 없이 로그인 UI가 즉시 반영.
 */
export default function OAuth2Redirect() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { loginWithToken, setAccessToken } = useAuth();
  const { t } = useTranslation(["member", "common"]);

  useEffect(() => {
    const run = async () => {
      try {
        let accessToken = params.get("accessToken");

        // 일부 provider/환경에서 hash로 올 수도 있어서 방어
        if (!accessToken && window.location.hash) {
          const hashParams = new URLSearchParams(
            window.location.hash.replace("#", "")
          );
          accessToken = hashParams.get("accessToken");
        }

        if (!accessToken) {
          console.error(
            t("member:oauth.noToken", { defaultValue: "토큰이 없습니다." })
          );
          nav("/login", { replace: true });
          return;
        }

        // ✅ 핵심: token 저장 + /members/me 로드까지 한 번에 처리
        if (typeof loginWithToken === "function") {
          await loginWithToken(accessToken);
        } else {
          // 혹시 old build에서 loginWithToken이 없을 때라도 토큰 저장은 해두기
          await setAccessToken(accessToken);
        }

        nav("/home", { replace: true });
      } catch (e) {
        console.error("OAUTH_REDIRECT_ERR:", e);
        nav("/login", { replace: true });
      }
    };

    run();
  }, [params, nav, loginWithToken, setAccessToken, t]);

  return (
    <div className="p-6">
      {t("member:oauth.processing", { defaultValue: "로그인 처리 중..." })}
    </div>
  );
}
