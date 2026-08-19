"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setNickname } from "@/app/[locale]/me/actions";
import { NICKNAME_MAX, authorTag, isNicknameShape } from "@/lib/board";

/**
 * 닉네임 편집.
 *
 * 비우고 저장하면 지워지고, 게시판에서는 다시 해시 별칭으로 보인다.
 * 그래서 지금 무엇으로 보이는지를 항상 함께 띄운다 — 저장 전에 결과를 알 수 있어야 한다.
 */
export function NicknameForm({
  userId,
  initial,
}: {
  userId: string;
  initial: string | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState<string | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const trimmed = value.trim();
  const shown = trimmed === "" ? authorTag(userId) : trimmed;
  const dirty = trimmed !== (saved ?? "");
  const badShape = trimmed !== "" && !isNicknameShape(trimmed);

  function save() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const res = await setNickname(value);
      if (!res.ok) {
        setError(t(`shelf.nickname${res.code === "taken" ? "Taken" : "Invalid"}`));
        return;
      }
      setSaved(res.nickname);
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="pt-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="u-label">{t("shelf.nickname")}</span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setDone(false);
              setError(null);
            }}
            maxLength={NICKNAME_MAX}
            className="mt-2 w-full border border-edge bg-panel px-3 py-[10px] text-[14px] text-ink outline-none focus:border-amber"
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || badShape || pending}
          className="border border-edge px-5 py-[10px] font-mono text-[12px] tracking-btn text-ink transition-colors hover:border-ink disabled:cursor-not-allowed disabled:text-dim"
        >
          {t("shelf.save")}
        </button>
      </div>

      <p className="mt-2 text-[13px] text-mute">
        {t("shelf.nicknameHint")}{" "}
        <b className="font-mono text-ink">{shown}</b>
      </p>

      {error && (
        <p className="mt-3 border border-games px-4 py-2 text-[13px] text-ink">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-3 font-mono text-[12px] text-amber">{t("shelf.saved")}</p>
      )}
    </div>
  );
}
