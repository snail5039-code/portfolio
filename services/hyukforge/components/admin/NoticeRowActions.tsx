"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setNoticePinned,
  setNoticeStatus,
  type NoticeStatus,
} from "@/app/[locale]/admin/notices/actions";

/**
 * 목록에서 바로 올리고 내린다.
 *
 * 왜 목록에 두는가
 *   상태 하나 바꾸려고 수정 화면에 들어가면 번역 10개가 딸린 폼을 통째로
 *   다시 저장하게 된다. 급히 내려야 할 때 거쳐야 할 화면이 하나 더 있는 것도
 *   그 자체로 비용이다. 여기서 누르면 본문은 건드리지 않는다.
 *
 * 화면에서 감추는 건 편의일 뿐이고 실제 차단은 RLS 정책과 서버 액션의
 * 권한 검사가 한다 (app/[locale]/admin/notices/actions.ts).
 */
export function NoticeRowActions({
  id,
  status,
  isPinned,
}: {
  id: string;
  status: NoticeStatus;
  isPinned: boolean;
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

  const move = (next: NoticeStatus) => run(() => setNoticeStatus(id, next));

  return (
    <div className="flex flex-wrap items-center justify-end gap-[6px]">
      {error && (
        <span className="w-full text-right text-[12px] text-games">{error}</span>
      )}

      {status === "published" ? (
        <>
          <Button onClick={() => move("draft")} disabled={pending}>
            내리기
          </Button>
          <Button onClick={() => move("archived")} disabled={pending} quiet>
            보관
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => move("published")} disabled={pending} primary>
            올리기
          </Button>
          {status === "archived" && (
            <Button onClick={() => move("draft")} disabled={pending} quiet>
              초안으로
            </Button>
          )}
        </>
      )}

      <Button
        onClick={() => run(() => setNoticePinned(id, !isPinned))}
        disabled={pending}
        quiet={isPinned}
      >
        {isPinned ? "고정 해제" : "고정"}
      </Button>
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  primary,
  quiet,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  quiet?: boolean;
}) {
  const tone = primary
    ? "border-amber bg-amber text-on-amber hover:bg-amber-hi"
    : quiet
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
