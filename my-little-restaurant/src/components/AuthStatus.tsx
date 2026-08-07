"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import OAuthLoginButton from "./OAuthLoginButton";

export default function AuthStatus() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const readUser = (
      user:
        | { user_metadata?: Record<string, unknown>; email?: string }
        | null
        | undefined
    ) => {
      const metadata = user?.user_metadata ?? {};
      const name =
        (metadata.nickname as string | undefined) ??
        (metadata.name as string | undefined) ??
        (metadata.full_name as string | undefined) ??
        user?.email ??
        null;
      setNickname(name);
    };

    supabase.auth.getUser().then(({ data }) => {
      readUser(data.user);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        readUser(session?.user);
      }
    );

    return () => subscription.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (loading) {
    return <div className="h-[76px]" />;
  }

  if (!nickname) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-muted p-3">
        <p className="text-xs leading-relaxed text-muted">
          로그인하면 나만의 맛집을 저장할 수 있어요.
        </p>
        <OAuthLoginButton provider="kakao" size="sm" fullWidth label="카카오" />
        <OAuthLoginButton provider="google" size="sm" fullWidth label="Google" />
      </div>
    );
  }

  const initial = nickname.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface-muted p-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
        {initial}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
        {nickname}
      </span>
      <button
        onClick={handleLogout}
        aria-label="로그아웃"
        title="로그아웃"
        className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
