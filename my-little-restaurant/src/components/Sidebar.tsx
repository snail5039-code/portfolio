"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Home,
  UtensilsCrossed,
  CircleUserRound,
  Menu,
  X,
  MessagesSquare,
} from "lucide-react";
import AuthStatus from "./AuthStatus";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: Home },
  { href: "/restaurants", label: "맛집 리스트", icon: UtensilsCrossed },
  { href: "/board", label: "커뮤니티", icon: MessagesSquare },
  { href: "/mypage", label: "마이페이지", icon: CircleUserRound },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand text-white">
        <UtensilsCrossed className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <span className="text-[15px] font-bold tracking-tight text-foreground">
        나만의 작은 맛집
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex items-center gap-2.5 py-2.5 pl-4 pr-3 text-sm transition-colors ${
              isActive
                ? "font-semibold text-brand"
                : "text-muted hover:text-foreground"
            }`}
          >
            {/* 활성 표시는 배경을 꽉 채우는 대신 왼쪽 얇은 막대로 */}
            <span
              className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand transition-opacity ${
                isActive ? "opacity-100" : "opacity-0"
              }`}
            />
            <item.icon className="h-4 w-4" strokeWidth={isActive ? 2.4 : 1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* 모바일: 상단 바 */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Wordmark />
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="메뉴 열기"
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[17rem] max-w-[82vw] flex-col gap-5 border-r border-line bg-surface py-4 shadow-2xl">
            <div className="flex items-center justify-between px-4">
              <Wordmark />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <div className="mt-auto px-4">
              <AuthStatus />
            </div>
          </div>
        </div>
      )}

      {/* 데스크톱: 좌측 고정 사이드바 */}
      <aside className="sticky top-0 hidden h-screen w-[15rem] shrink-0 flex-col gap-6 border-r border-line bg-surface py-5 md:flex">
        <div className="px-4">
          <Wordmark />
        </div>
        <NavLinks />
        <div className="mt-auto px-4">
          <AuthStatus />
        </div>
      </aside>
    </>
  );
}
