"use client";

import { useState, useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeNames, locales } from "@/i18n/routing";

/**
 * 언어 전환. 10개라 드롭다운으로 낸다.
 * 지금 경로를 유지한 채 언어만 바꾼다 (/ko/products → /ja/products).
 */
export function LocaleSwitcher() {
  const active = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function go(locale: string) {
    setOpen(false);
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={pending}
        className="border border-transparent px-2 py-[6px] font-mono text-[12px] tracking-tag text-dim transition-colors hover:text-ink disabled:opacity-50"
      >
        {localeNames[active as keyof typeof localeNames] ?? active}
        <span className="ml-2 text-[8px]">▼</span>
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다 */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <ul
            role="listbox"
            className="absolute right-0 top-full z-20 mt-1 min-w-[150px] border border-edge bg-bg"
          >
            {locales.map((l) => (
              <li key={l}>
                <button
                  type="button"
                  role="option"
                  aria-selected={l === active}
                  onClick={() => go(l)}
                  className={`flex w-full items-baseline justify-between gap-4 px-3 py-2 text-left font-mono text-[12px] transition-colors hover:bg-panel hover:text-ink ${
                    l === active ? "text-amber" : "text-mute"
                  }`}
                >
                  {localeNames[l]}
                  <span className="text-[9px] text-dim">{l}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
