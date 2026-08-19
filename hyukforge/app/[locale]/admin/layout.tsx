import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/queries/admin";

/**
 * 관리자 화면.
 *
 * 권한 검사는 여기 한 곳에서만 한다. 페이지마다 반복하지 않는다.
 * (docs/ARCHITECTURE.md 폴더 구조 규칙)
 *
 * 화면 문구는 한국어로 박아둔다. 이건 실수가 아니라 판단이다 —
 * 쓰는 사람이 한 명이고, 관리 도구를 10개 언어로 번역하는 건 낭비다.
 * 사용자에게 보이는 화면은 전부 messages/*.json 을 쓴다.
 */
export const dynamic = "force-dynamic";

const MENU = [
  ["/admin", "제품"],
  ["/admin/notices", "공지"],
  ["/admin/changelog", "개발 기록"],
  ["/admin/boards", "게시판 관리"],
] as const;

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/${locale}/login?next=/${locale}/admin`);

  // 로그인은 했지만 관리자가 아니면 존재를 알리지 않는다.
  // 권한 없음(403)을 보여주면 관리자 화면이 있다는 사실이 새어나간다.
  if (!(await isAdmin())) notFound();

  return (
    <div className="mx-auto max-w-page px-gutter pb-16">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-edge pb-4 pt-10">
        <h1 className="font-mono text-[13px] tracking-mark text-amber">ADMIN</h1>
        <nav className="flex flex-wrap gap-5">
          {MENU.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-[13.5px] text-mute transition-colors hover:text-ink"
            >
              {label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto font-mono text-[12px] text-dim">
          {user.email}
        </span>
      </header>
      {children}
    </div>
  );
}
