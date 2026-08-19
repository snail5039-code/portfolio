"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * 좁은 화면의 메뉴.
 *
 * 원래 네비게이션은 md 아래에서 `hidden` 이라 통째로 사라졌다. 대신 나오는 것도
 * 없어서 휴대폰으로 들어오면 로고 말고는 갈 데가 없었다. 접힌 게 아니라 없었다.
 *
 * 드롭다운은 언어 전환과 같은 방식이다 — 바깥을 눌러 닫는다.
 * 넓은 화면으로 바뀌면 바깥의 md:hidden 이 통째로 감추므로 따로 닫지 않아도 된다.
 * 장식은 넣지 않는다. 1px 선과 여백만 쓴다. (docs/DESIGN.md)
 */
export function MobileMenu({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={t("nav.menu")}
        className="flex h-[34px] w-[34px] flex-col items-center justify-center gap-[5px] border border-edge transition-colors hover:border-ink"
      >
        <span className="block h-px w-[15px] bg-mute" />
        <span className="block h-px w-[15px] bg-mute" />
        <span className="block h-px w-[15px] bg-mute" />
      </button>

      {open && (
        <>
          {/* 바깥을 누르면 닫힌다 */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-[58px] z-10 cursor-default"
          />
          <nav className="absolute left-0 right-0 top-full z-20 border-b border-edge bg-bg">
            <ul className="mx-auto max-w-page px-gutter">
              {items.map((it) => (
                <li key={it.href} className="border-t border-line first:border-t-0">
                  <Link
                    href={it.href}
                    onClick={() => setOpen(false)}
                    className="block py-[14px] text-[15px] text-ink transition-colors hover:text-amber"
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}
