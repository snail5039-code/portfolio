"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { deleteAccount } from "@/app/[locale]/me/actions";

/**
 * 탈퇴.
 *
 * 두 단계로 나눈다. 접혀 있는 걸 펴야 입력칸이 나오고, 이메일을 그대로
 * 받아적어야 버튼이 눌린다. 되돌릴 수 없는 동작이라 실수로 지나가지 않게 한다.
 *
 * 무엇이 사라지는지 버튼 위에 먼저 적는다 — 누른 다음에 알려주면 늦다.
 * 앰버는 쓰지 않는다. 강조색은 권하는 것에 쓰고, 이건 권하는 동작이 아니다.
 */
export function DeleteAccount({ email, locale }: { email: string; locale: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  function run() {
    // 마지막 관문. 이메일까지 받아적은 사람이라도 여기서 한 번 더 멈춘다 —
    // 되돌릴 수 없는 동작이라 손이 미끄러진 경우를 남겨두지 않는다.
    // 게시글 삭제와 같은 방식이다 (components/board/PostControls.tsx).
    if (!confirm(t("shelf.deleteAsk"))) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteAccount(typed);
      if (!res.ok) {
        setError(t(res.code === "mismatch" ? "shelf.deleteMismatch" : "shelf.deleteFailed"));
        return;
      }
      // 계정이 사라졌으니 개인 화면에 머물 수 없다
      router.replace(`/${locale}`);
      router.refresh();
    });
  }

  return (
    <section className="mt-14 border-t border-line pt-8">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-[12px] tracking-btn text-dim underline-offset-4 transition-colors hover:text-games hover:underline"
        >
          {t("shelf.deleteAccount")}
        </button>
      ) : (
        <div className="max-w-[62ch] border border-games px-5 py-5">
          <h2 className="text-[15px] font-semibold text-ink">
            {t("shelf.deleteAccount")}
          </h2>
          <p className="mt-3 text-[13.5px] leading-[1.7] text-mute">
            {t("shelf.deleteWhatGoes")}
          </p>

          <label className="mt-5 block">
            <span className="u-label">{t("shelf.deleteConfirmHint")}</span>
            <input
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                setError(null);
              }}
              placeholder={email}
              autoComplete="off"
              className="mt-2 w-full border border-edge bg-panel px-3 py-[10px] font-mono text-[13px] text-ink placeholder:text-dim focus:border-games focus:outline-none"
            />
          </label>

          {error && (
            <p className="mt-3 text-[13px] text-games">{error}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={run}
              disabled={!matches || pending}
              className="border border-games px-5 py-[10px] font-mono text-[12px] tracking-btn text-games transition-colors hover:bg-games hover:text-bg disabled:cursor-not-allowed disabled:border-edge disabled:text-dim disabled:hover:bg-transparent disabled:hover:text-dim"
            >
              {pending ? t("shelf.deleting") : t("shelf.deleteButton")}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              disabled={pending}
              className="font-mono text-[12px] tracking-btn text-dim transition-colors hover:text-ink"
            >
              {t("board.cancel")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
