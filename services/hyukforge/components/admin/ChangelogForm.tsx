"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveChangelogEntry,
  deleteChangelogEntry,
} from "@/app/[locale]/admin/changelog/actions";
import { Field, inputCls } from "./fields";
import { shortDate } from "@/lib/format";
import type {
  AdminChangelogRow,
  ChangelogDraft,
} from "@/lib/queries/admin-content";

/**
 * 개발 기록 작성.
 *
 * 항목이 한 줄짜리라 제품 폼처럼 페이지를 따로 두지 않는다.
 * 위에서 쓰고 아래 목록에서 바로 고친다 — 여러 건을 연달아 적는 게 보통이라
 * 매번 목록으로 돌아왔다 들어가는 게 더 번거롭다.
 *
 * ko 만 필수다. en 을 비우면 그 행을 지우고 폴백(ko)이 대신한다.
 */
export function ChangelogForm({
  entries,
  products,
}: {
  entries: AdminChangelogRow[];
  products: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [d, setD] = useState<ChangelogDraft>(blank());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ChangelogDraft>(k: K, v: ChangelogDraft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveChangelogEntry(d);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      setD(blank());
      router.refresh();
    });
  }

  function edit(row: AdminChangelogRow) {
    setError(null);
    setSaved(false);
    setD({
      id: row.id,
      productId: row.productId,
      entryDate: row.date,
      ko: row.ko,
      en: row.en,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function remove(row: AdminChangelogRow) {
    if (!confirm(`${row.date} 기록을 지웁니다. 되돌릴 수 없습니다.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteChangelogEntry(row.id);
      if (!res.ok) setError(res.message);
      else {
        if (d.id === row.id) setD(blank());
        router.refresh();
      }
    });
  }

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">
          {d.id ? "기록 수정" : "새 기록"}
        </h2>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
        {d.id && (
          <button
            type="button"
            onClick={() => {
              setD(blank());
              setError(null);
            }}
            className="font-mono text-[12px] text-dim transition-colors hover:text-ink"
          >
            새로 쓰기로
          </button>
        )}
      </div>

      {error && (
        <p className="mb-5 border border-games px-4 py-3 text-[13.5px] text-ink">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="mb-5 border border-amber px-4 py-3 text-[13.5px] text-amber">
          저장했습니다.
        </p>
      )}

      <div className="space-y-5 border border-edge p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="날짜">
            <input
              type="date"
              value={d.entryDate}
              onChange={(e) => set("entryDate", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="제품" hint="스튜디오 전체 소식이면 비워둔다">
            <select
              value={d.productId ?? ""}
              onChange={(e) => set("productId", e.target.value || null)}
              className={inputCls}
            >
              <option value="">전체 소식</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="내용 (ko)" hint="무엇을 고쳤는지 한 줄. '~했다' 로 끝낸다">
          <textarea
            value={d.ko}
            onChange={(e) => set("ko", e.target.value)}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <Field label="내용 (en)" hint="비우면 ko 가 대신 쓰인다">
          <textarea
            value={d.en}
            onChange={(e) => set("en", e.target.value)}
            rows={3}
            className={`${inputCls} resize-y`}
          />
        </Field>

        <button
          type="button"
          onClick={submit}
          disabled={pending || !d.ko.trim() || !d.entryDate}
          className="border border-amber bg-amber px-6 py-[11px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi disabled:cursor-not-allowed disabled:border-edge disabled:bg-transparent disabled:text-dim"
        >
          {pending ? "저장 중" : d.id ? "수정 저장" : "추가"}
        </button>
      </div>

      <div className="mb-4 mt-12 flex items-baseline gap-4">
        <h3 className="text-[17px] font-semibold">기록 {entries.length}건</h3>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
      </div>

      {entries.length === 0 ? (
        <p className="border-y border-line py-16 text-center text-[13.5px] text-dim">
          아직 기록이 없습니다.
        </p>
      ) : (
        <ul className="border-t border-line">
          {entries.map((e) => (
            <li
              key={e.id}
              className={`border-b border-line py-[13px] ${
                d.id === e.id ? "bg-panel" : ""
              }`}
            >
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <time className="font-mono text-[12px] text-dim">
                  {shortDate(e.date)}
                </time>
                <span className="font-mono text-[12px] text-mute">
                  {e.productName ?? "전체 소식"}
                </span>
                {!e.en && (
                  <span className="border border-edge px-2 py-[1px] font-mono text-[11px] text-dim">
                    en 없음
                  </span>
                )}
                <span className="ml-auto flex gap-3 font-mono text-[12px]">
                  <button
                    type="button"
                    onClick={() => edit(e)}
                    disabled={pending}
                    className="text-dim transition-colors hover:text-amber"
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(e)}
                    disabled={pending}
                    className="text-dim transition-colors hover:text-games"
                  >
                    삭제
                  </button>
                </span>
              </div>
              <p className="mt-[6px] text-[14px] text-ink">{e.ko}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function blank(): ChangelogDraft {
  // 오늘 날짜를 미리 채운다 — 대부분 오늘 한 일을 적는다.
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    id: null,
    productId: null,
    entryDate: `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`,
    ko: "",
    en: "",
  };
}
