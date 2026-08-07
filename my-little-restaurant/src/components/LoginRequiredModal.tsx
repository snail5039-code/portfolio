"use client";

import { useEffect } from "react";
import { X, Lock } from "lucide-react";
import OAuthLoginButton from "./OAuthLoginButton";

export default function LoginRequiredModal({
  open,
  onClose,
  message = "로그인 후 이용할 수 있는 기능이에요.",
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
}) {
  // ESC로 닫기 + 열려 있는 동안 뒤 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-required-title"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[22rem] rounded-xl border border-line bg-surface p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted text-brand">
          <Lock className="h-5 w-5" strokeWidth={1.8} />
        </span>

        <h2
          id="login-required-title"
          className="mt-4 text-[17px] font-bold text-foreground"
        >
          로그인이 필요해요
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          {message}
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <OAuthLoginButton provider="kakao" fullWidth />
          <OAuthLoginButton provider="google" fullWidth />
        </div>
      </div>
    </div>
  );
}
