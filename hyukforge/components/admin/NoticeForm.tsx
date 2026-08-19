"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames } from "@/i18n/routing";
import { saveNotice, deleteNotice } from "@/app/[locale]/admin/notices/actions";
import { Field, FormActions, LocaleTabs, Toggle, inputCls } from "./fields";
import type { NoticeDraft } from "@/lib/queries/admin-content";

/**
 * 공지 작성·수정.
 *
 * 제품 폼과 같은 구조다 — 언어 탭 10개를 한 화면에 두고 한 번에 저장한다.
 * 언어마다 저장을 나누면 절반만 저장된 상태가 생긴다.
 *
 * 제목과 본문이 둘 다 있는 언어만 저장된다. 한쪽만 채우면 그 언어는
 * 아예 만들어지지 않고 폴백이 대신한다 — 반쪽짜리 공지를 띄우지 않으려는 것이다.
 */
const STATUSES = [
  ["draft", "초안 — 아무에게도 보이지 않는다"],
  ["published", "발행 — 목록에 나온다"],
  ["archived", "보관 — 목록에서 내린다"],
] as const;

export function NoticeForm({
  initial,
  locale,
}: {
  initial: NoticeDraft;
  locale: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<NoticeDraft>(initial);
  const [tab, setTab] = useState("ko");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof NoticeDraft>(k: K, v: NoticeDraft[K]) => {
    setD((p) => ({ ...p, [k]: v }));
    setSaved(false);
  };

  const setT = (loc: string, field: string, v: string | boolean) => {
    setD((p) => ({
      ...p,
      translations: { ...p.translations, [loc]: { ...p.translations[loc], [field]: v } },
    }));
    setSaved(false);
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveNotice(d);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      if (!d.id) router.replace(`/${locale}/admin/notices/${res.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!d.id) return;
    if (!confirm(`'${d.slug}' 공지를 지웁니다. 되돌릴 수 없습니다.`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteNotice(d.id!);
      if (!res.ok) setError(res.message);
      else router.replace(`/${locale}/admin/notices`);
    });
  }

  const done = (l: string) =>
    !!d.translations[l]?.title?.trim() && !!d.translations[l]?.body?.trim();
  const filled = locales.filter(done).length;

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">{d.id ? "공지 수정" : "새 공지"}</h2>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
        <span className="font-mono text-[12px] text-dim">
          번역 {filled}/{locales.length}
        </span>
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

      <div className="grid gap-12 lg:grid-cols-[minmax(0,34fr)_minmax(0,66fr)]">
        <section className="space-y-5">
          <Field label="주소 (slug)" hint="/notices/여기 · 영문 소문자·숫자·하이픈">
            <input
              value={d.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="v1-2-0-release"
              className={inputCls}
            />
          </Field>

          <Field label="상태">
            <select
              value={d.status}
              onChange={(e) => set("status", e.target.value as NoticeDraft["status"])}
              className={inputCls}
            >
              {STATUSES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="발행 시각" hint="비우면 발행할 때 지금 시각으로 채워진다">
            <input
              type="datetime-local"
              value={d.publishedAt}
              onChange={(e) => set("publishedAt", e.target.value)}
              className={inputCls}
            />
          </Field>

          <Toggle
            label="맨 위에 고정"
            hint="중요한 공지 하나만. 여러 개를 고정하면 고정이 뜻을 잃는다"
            checked={d.isPinned}
            onChange={(v) => set("isPinned", v)}
          />
        </section>

        <section>
          <div className="mb-4 flex items-baseline gap-4">
            <h3 className="text-[17px] font-semibold">본문</h3>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
            <span className="u-label">ko 는 필수 · 제목과 본문이 한 쌍</span>
          </div>

          <LocaleTabs
            locales={locales}
            names={localeNames}
            filled={done}
            active={tab}
            onPick={setTab}
          />

          <div className="space-y-5 border border-edge p-6">
            <Field label="제목">
              <input
                value={d.translations[tab]?.title ?? ""}
                onChange={(e) => setT(tab, "title", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="본문" hint="빈 줄로 문단을 나눈다">
              <textarea
                value={d.translations[tab]?.body ?? ""}
                onChange={(e) => setT(tab, "body", e.target.value)}
                rows={14}
                className={`${inputCls} resize-y`}
              />
            </Field>
            <Toggle
              label="사람이 검수함"
              hint="기계번역을 그대로 둔 상태면 끄기"
              checked={d.translations[tab]?.isReviewed ?? false}
              onChange={(v) => setT(tab, "isReviewed", v)}
            />
          </div>
        </section>
      </div>

      <FormActions
        pending={pending}
        onSave={submit}
        onDelete={d.id ? remove : undefined}
        deleteLabel="공지 삭제"
      />
    </div>
  );
}
