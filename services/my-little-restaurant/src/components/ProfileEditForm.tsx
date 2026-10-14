"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDown, Loader2, Lock } from "lucide-react";
import { updateProfile } from "@/app/mypage/actions";
import type { ActionState } from "@/app/restaurants/actions";

const initialState: ActionState = {};

const FIELD_CLASS =
  "rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted focus:border-brand";

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-strong disabled:opacity-60"
    >
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      저장
    </button>
  );
}

export default function ProfileEditForm({
  nickname,
  phone,
  email,
}: {
  nickname: string;
  phone: string;
  email: string;
}) {
  const [open, setOpen] = useState(true);
  const [state, formAction] = useActionState(updateProfile, initialState);

  return (
    <section className="h-fit rounded-lg border border-line bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left text-sm font-bold text-foreground"
      >
        개인정보 수정
        <ChevronDown
          className={`h-4 w-4 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <form
          action={formAction}
          className="flex flex-col gap-3.5 border-t border-line p-5"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              닉네임
            </span>
            <input
              name="nickname"
              defaultValue={nickname}
              required
              maxLength={20}
              placeholder="닉네임을 입력하세요"
              className={FIELD_CLASS}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              전화번호
            </span>
            <input
              name="phone"
              defaultValue={phone}
              placeholder="010-0000-0000"
              inputMode="tel"
              className={FIELD_CLASS}
            />
          </label>

          {/* 소셜 로그인 계정 정보라 수정 불가 */}
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              이메일
            </span>
            <span className="flex items-center gap-2 rounded-md border border-line bg-surface-muted px-3 py-2 text-[13px] text-muted">
              <Lock className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
              <span className="min-w-0 flex-1 truncate">{email || "–"}</span>
            </span>
            <span className="text-[11px] leading-relaxed text-muted">
              이메일과 비밀번호는 소셜 로그인 계정 정보라 이곳에서 바꿀 수 없어요.
            </span>
          </label>

          {state.error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {state.error}
            </p>
          )}
          {state.success && (
            <p className="text-[13px] font-medium text-brand">저장했어요.</p>
          )}

          <div className="flex justify-end pt-1">
            <SaveButton />
          </div>
        </form>
      )}
    </section>
  );
}
