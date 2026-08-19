"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { locales, localeNames } from "@/i18n/routing";
import { saveProduct, deleteProduct } from "@/app/[locale]/admin/products/actions";
import type { ProductDraft } from "@/lib/queries/admin";
import { Field, Toggle, inputCls } from "./fields";

/**
 * 제품 등록·수정 폼.
 *
 * 언어 탭 10개를 한 화면에 두고 한 번에 저장한다. 언어마다 저장을 나누면
 * 절반만 저장된 상태가 생긴다.
 *
 * 화면 문구는 한국어로 박아둔다 — 관리 도구라 의도한 것이다.
 * (app/[locale]/admin/layout.tsx 주석 참고)
 */

const PLATFORMS = ["windows", "macos", "linux", "android", "ios"] as const;

const KINDS = [
  ["download", "다운로드 — 설치파일을 받는다"],
  ["webapp", "웹앱 — 주소를 열어 쓴다"],
  ["source", "소스코드 — 저장소나 압축파일"],
] as const;

const STATUSES = [
  ["draft", "초안 — 아무에게도 보이지 않는다"],
  ["published", "발행 — 목록에 나온다"],
  ["archived", "보관 — 목록에서 내린다"],
] as const;

export function ProductForm({
  initial,
  categories,
  locale,
}: {
  initial: ProductDraft;
  categories: { id: string; slug: string }[];
  locale: string;
}) {
  const router = useRouter();
  const [d, setD] = useState<ProductDraft>(initial);
  const [tab, setTab] = useState("ko");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    setSaved(false);
  };

  const setT = (loc: string, field: string, v: string | boolean) => {
    setD((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [loc]: { ...prev.translations[loc], [field]: v },
      },
    }));
    setSaved(false);
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveProduct(d);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSaved(true);
      // 새로 만든 경우 수정 화면으로 옮겨가야 이후 저장이 갱신으로 동작한다
      if (!d.id) router.replace(`/${locale}/admin/products/${res.id}`);
      else router.refresh();
    });
  }

  function remove() {
    if (!d.id) return;
    if (!confirm(`'${d.slug}' 제품을 지웁니다. 되돌릴 수 없습니다.`)) return;

    setError(null);
    startTransition(async () => {
      const res = await deleteProduct(d.id!);
      if (!res.ok) setError(res.message);
      else router.replace(`/${locale}/admin`);
    });
  }

  const filled = locales.filter((l) => d.translations[l]?.name?.trim()).length;

  return (
    <div className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">
          {d.id ? "제품 수정" : "새 제품"}
        </h2>
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

      <div className="grid gap-12 lg:grid-cols-[minmax(0,42fr)_minmax(0,58fr)]">
        {/* ── 기본 정보 ───────────────────────────── */}
        <section className="space-y-5">
          <Field label="주소 (slug)" hint="/products/여기 · 영문 소문자·숫자·하이픈">
            <input
              value={d.slug}
              onChange={(e) => set("slug", e.target.value)}
              placeholder="file-organizer"
              className={inputCls}
            />
          </Field>

          <Field label="종류">
            <select
              value={d.kind}
              onChange={(e) => set("kind", e.target.value as ProductDraft["kind"])}
              className={inputCls}
            >
              {KINDS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="분류">
            <select
              value={d.categoryId ?? ""}
              onChange={(e) => set("categoryId", e.target.value || null)}
              className={inputCls}
            >
              <option value="">선택 안 함</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.slug}
                </option>
              ))}
            </select>
          </Field>

          <Field label="상태">
            <select
              value={d.status}
              onChange={(e) => set("status", e.target.value as ProductDraft["status"])}
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

          <Field label="아이콘 글자" hint="이미지 대신 쓰는 한 글자">
            <input
              value={d.iconLetter}
              onChange={(e) => set("iconLetter", e.target.value.slice(0, 2))}
              maxLength={2}
              placeholder="F"
              className={`${inputCls} w-20`}
            />
          </Field>

          <Field label="환경">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {PLATFORMS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-[13px] text-mute">
                  <input
                    type="checkbox"
                    checked={d.platforms.includes(p)}
                    onChange={(e) =>
                      set(
                        "platforms",
                        e.target.checked
                          ? [...d.platforms, p]
                          : d.platforms.filter((x) => x !== p),
                      )
                    }
                    className="accent-amber"
                  />
                  {p}
                </label>
              ))}
            </div>
          </Field>

          <Toggle
            label="대표 제품으로 표시"
            hint="홈에서 크게 보인다. 하나만 켜는 게 좋다"
            checked={d.isFeatured}
            onChange={(v) => set("isFeatured", v)}
          />

          <Toggle
            label="받으려면 로그인 필요"
            checked={d.requiresLogin}
            onChange={(v) => set("requiresLogin", v)}
          />
        </section>

        {/* ── 주소·가격·번역 ──────────────────────── */}
        <section className="space-y-5">
          <Field label="열 주소" hint="웹앱일 때 필수. 새 창으로 연다">
            <input
              value={d.externalUrl}
              onChange={(e) => set("externalUrl", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>

          <Field label="체험 주소" hint="받기 전에 브라우저에서 바로 써보게 한다">
            <input
              value={d.demoUrl}
              onChange={(e) => set("demoUrl", e.target.value)}
              placeholder="https://..."
              className={inputCls}
            />
          </Field>

          <Field label="영상 주소" hint="YouTube 또는 mp4 직링크">
            <input
              value={d.videoUrl}
              onChange={(e) => set("videoUrl", e.target.value)}
              placeholder="https://youtu.be/..."
              className={inputCls}
            />
          </Field>

          <Field label="GitHub 저장소" hint="계정/저장소 형식">
            <input
              value={d.githubRepo}
              onChange={(e) => set("githubRepo", e.target.value)}
              placeholder="snail5039-code/file-organizer"
              className={inputCls}
            />
          </Field>

          <Toggle
            label="무료"
            hint="끄면 가격과 결제 주소가 필요하다"
            checked={d.isFree}
            onChange={(v) => set("isFree", v)}
          />

          {!d.isFree && (
            <div className="space-y-5 border-l border-edge pl-4">
              <Field label="가격 (원)">
                <input
                  type="number"
                  value={d.priceKrw}
                  onChange={(e) => set("priceKrw", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="결제 주소" hint="Gumroad · Lemon Squeezy 등">
                <input
                  value={d.checkoutUrl}
                  onChange={(e) => set("checkoutUrl", e.target.value)}
                  placeholder="https://..."
                  className={inputCls}
                />
              </Field>
            </div>
          )}
        </section>
      </div>

      {/* ── 번역 ──────────────────────────────────── */}
      <section className="pt-12">
        <div className="mb-4 flex items-baseline gap-4">
          <h3 className="text-[17px] font-semibold">이름과 설명</h3>
          <span className="-translate-y-[3px] flex-1 border-t border-line" />
          <span className="u-label">ko · en 은 필수</span>
        </div>

        <div className="mb-4 flex flex-wrap gap-[2px]">
          {locales.map((l) => {
            const has = !!d.translations[l]?.name?.trim();
            return (
              <button
                key={l}
                type="button"
                onClick={() => setTab(l)}
                className={`border px-3 py-2 font-mono text-[12px] tracking-tag transition-colors ${
                  tab === l
                    ? "border-amber text-amber"
                    : has
                      ? "border-edge text-mute hover:text-ink"
                      : "border-transparent text-dim hover:text-ink"
                }`}
              >
                {localeNames[l]}
                {has && <span className="ml-[5px] text-amber">·</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-5 border border-edge p-6">
          <Field label="이름">
            <input
              value={d.translations[tab]?.name ?? ""}
              onChange={(e) => setT(tab, "name", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="한 줄 소개" hint="목록에 나온다">
            <input
              value={d.translations[tab]?.tagline ?? ""}
              onChange={(e) => setT(tab, "tagline", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="설명" hint="빈 줄로 문단을 나눈다. 만든 이유를 한 문장 넣기">
            <textarea
              value={d.translations[tab]?.description ?? ""}
              onChange={(e) => setT(tab, "description", e.target.value)}
              rows={8}
              className={`${inputCls} resize-y`}
            />
          </Field>
          <Field label="시스템 요구사항" hint="한 줄에 하나">
            <textarea
              value={d.translations[tab]?.requirements ?? ""}
              onChange={(e) => setT(tab, "requirements", e.target.value)}
              rows={4}
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

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="border border-amber bg-amber px-6 py-[12px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi disabled:opacity-50"
        >
          {pending ? "저장 중" : "저장"}
        </button>

        {d.id && (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="border border-edge px-5 py-[12px] font-mono text-[12px] tracking-btn text-dim transition-colors hover:border-games hover:text-games disabled:opacity-50"
          >
            삭제
          </button>
        )}

        {d.id && d.status === "published" && (
          <a
            href={`/${locale}/products/${d.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-mono text-[12px] text-dim transition-colors hover:text-amber"
          >
            공개 화면 보기 ↗
          </a>
        )}
      </div>
    </div>
  );
}
