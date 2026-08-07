"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { KakaoIcon, GoogleIcon } from "./BrandIcons";

type Provider = "kakao" | "google";
type Size = "md" | "sm";

const LABEL: Record<Provider, string> = {
  kakao: "카카오로 계속하기",
  google: "Google로 계속하기",
};

/*
  각 브랜드의 공식 버튼 규격에 맞춘 색. 카카오는 #FEE500 + 검정 심볼,
  구글은 흰 배경 + 회색 테두리가 브랜드 가이드 기준이다.
*/
const STYLE: Record<Provider, string> = {
  kakao:
    "bg-[#FEE500] text-[#191600] border-transparent hover:brightness-[0.97]",
  google:
    "bg-white text-[#1f1f1f] border-[#dadce0] hover:bg-[#f8f9fa] dark:bg-white",
};

export default function OAuthLoginButton({
  provider,
  size = "md",
  fullWidth = false,
  label,
}: {
  provider: Provider;
  size?: Size;
  fullWidth?: boolean;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // 성공하면 브라우저가 그대로 이동하므로 여기로 돌아오지 않는다.
    if (error) setLoading(false);
  };

  const Icon = provider === "kakao" ? KakaoIcon : GoogleIcon;

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2.5 rounded-md border font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition disabled:opacity-70 ${
        STYLE[provider]
      } ${size === "sm" ? "px-3 py-2 text-[13px]" : "px-4 py-2.5 text-sm"} ${
        fullWidth ? "w-full" : ""
      }`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-[18px] w-[18px]" />
      )}
      {label ?? LABEL[provider]}
    </button>
  );
}
