"use client";

/**
 * 관리자 폼 조각.
 *
 * 제품·공지·개발 기록 폼이 같이 쓴다. 원래 ProductForm 안에 있던 것을 꺼냈다.
 * 화면 문구는 한국어로 박아둔다 — 관리 도구라 의도한 것이다.
 * (app/[locale]/admin/layout.tsx 주석)
 */

export const inputCls =
  "w-full border border-edge bg-panel px-3 py-[10px] font-mono text-[13px] text-ink placeholder:text-dim focus:border-amber focus:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="u-label">{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-[6px] block text-[12px] text-dim">{hint}</span>}
    </label>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="flex items-center gap-2 text-[13.5px] text-ink">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="accent-amber"
        />
        {label}
      </span>
      {hint && <span className="mt-1 block pl-6 text-[12px] text-dim">{hint}</span>}
    </label>
  );
}

/** 언어 탭. 채워진 언어에 앰버 점을 붙여 진행 상태를 드러낸다. */
export function LocaleTabs({
  locales,
  names,
  filled,
  active,
  onPick,
}: {
  locales: readonly string[];
  names: Record<string, string>;
  filled: (locale: string) => boolean;
  active: string;
  onPick: (locale: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-[2px]">
      {locales.map((l) => {
        const has = filled(l);
        return (
          <button
            key={l}
            type="button"
            onClick={() => onPick(l)}
            className={`border px-3 py-2 font-mono text-[12px] tracking-tag transition-colors ${
              active === l
                ? "border-amber text-amber"
                : has
                  ? "border-edge text-mute hover:text-ink"
                  : "border-transparent text-dim hover:text-ink"
            }`}
          >
            {names[l]}
            {has && <span className="ml-[5px] text-amber">·</span>}
          </button>
        );
      })}
    </div>
  );
}

/** 저장·삭제 줄. 세 폼이 같은 모양을 쓴다. */
export function FormActions({
  pending,
  onSave,
  onDelete,
  deleteLabel = "삭제",
}: {
  pending: boolean;
  onSave: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-line pt-6">
      <button
        type="button"
        onClick={onSave}
        disabled={pending}
        className="border border-amber bg-amber px-6 py-[12px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi disabled:opacity-50"
      >
        {pending ? "저장 중" : "저장"}
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          className="border border-edge px-5 py-[12px] font-mono text-[12px] tracking-btn text-dim transition-colors hover:border-games hover:text-games disabled:opacity-50"
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
