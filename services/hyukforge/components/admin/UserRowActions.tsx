"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearNickname,
  setUserRole,
  type UserRole,
} from "@/app/[locale]/admin/users/actions";

/**
 * 회원 한 줄의 손볼 것들 — 권한과 닉네임.
 *
 * 권한을 올릴 때만 한 번 더 묻는다. 관리자를 붙이는 건 제품·공지·회원까지
 * 전부 넘기는 일이라 잘못 누르면 되돌리는 동안 이미 열려 있다. 내리는 쪽은
 * 묻지 않는다 — 실수여도 다시 누르면 그만이다.
 *
 * 자기 자신은 아예 버튼을 그리지 않는다. 눌러도 함수가 막지만
 * (admin_set_role), 막힐 걸 보여주고 누르게 할 이유가 없다.
 */
export function UserRowActions({
  userId,
  role,
  hasNickname,
  isSelf,
}: {
  userId: string;
  role: UserRole;
  hasNickname: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.message ?? "실패했습니다.");
        return;
      }
      router.refresh();
    });
  }

  function changeRole(next: UserRole) {
    if (
      next === "admin" &&
      !confirm("이 사람에게 관리자 권한을 줍니다. 제품·공지·회원을 모두 손볼 수 있게 됩니다.")
    ) {
      return;
    }
    run(() => setUserRole(userId, next));
  }

  if (isSelf) {
    return <span className="font-mono text-[11.5px] text-dim">나</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-[6px]">
      {error && (
        <span className="w-full text-right text-[12px] text-games">{error}</span>
      )}

      {role === "admin" ? (
        <Button onClick={() => changeRole("user")} disabled={pending} quiet>
          관리자 해제
        </Button>
      ) : (
        <Button onClick={() => changeRole("admin")} disabled={pending}>
          관리자로
        </Button>
      )}

      {hasNickname && (
        <Button
          onClick={() => run(() => clearNickname(userId))}
          disabled={pending}
          quiet
        >
          닉네임 지우기
        </Button>
      )}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  quiet,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  quiet?: boolean;
}) {
  const tone = quiet
    ? "border-edge text-dim hover:text-ink"
    : "border-edge text-mute hover:border-amber hover:text-amber";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`whitespace-nowrap border px-[10px] py-[5px] font-mono text-[11.5px] tracking-tag transition-colors disabled:opacity-40 ${tone}`}
    >
      {children}
    </button>
  );
}
