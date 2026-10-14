import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { AuthButton } from "./AuthButton";
import { MobileMenu } from "./MobileMenu";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";
import { AdminOnly } from "@/components/admin/AdminOnly";

export async function Nav() {
  const t = await getTranslations();

  const items = [
    { href: "/products", label: t("nav.products") },
    { href: "/downloads", label: t("nav.downloads") },
    { href: "/notices", label: t("nav.notices") },
    { href: "/board/free", label: t("nav.board") },
    { href: "/changelog", label: t("nav.changelog") },
    { href: "/about", label: t("nav.about") },
    { href: "/search", label: t("nav.search") },
  ];

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="relative mx-auto flex h-[58px] max-w-page items-center gap-5 px-gutter sm:gap-7">
        {/* 마크는 28px 미만으로 줄이지 않는다 — 사선 디테일이 뭉개진다.
            로고 PNG는 다크 배경 기준 잉크색이라 라이트 테마에서는 안 보인다.
            scripts/brand.mjs가 뽑은 라이트 변형(*.light.png)으로 통째로 바꿔 낀다
            (.brand-set, app/globals.css). */}
        <Link href="/" className="mr-auto flex items-center">
          <span className="brand-set" data-brand-img="dark">
            <Image
              src="/brand/mark.png"
              alt="HyukForge"
              width={458}
              height={331}
              priority
              className="h-7 w-auto"
            />
            <Image
              src="/brand/wordmark.png"
              alt=""
              width={950}
              height={88}
              priority
              className="hidden h-[12px] w-auto sm:block"
            />
          </span>
          <span className="brand-set" data-brand-img="light">
            <Image
              src="/brand/mark.light.png"
              alt="HyukForge"
              width={458}
              height={331}
              priority
              className="h-7 w-auto"
            />
            <Image
              src="/brand/wordmark.light.png"
              alt=""
              width={950}
              height={88}
              priority
              className="hidden h-[12px] w-auto sm:block"
            />
          </span>
        </Link>

        <ul className="hidden items-center gap-7 md:flex">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                className="text-[13.5px] text-mute transition-colors hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>

        <NotificationBell />

        {/* 관리자에게만 보인다. 주소를 외워서 치고 들어가지 않아도 되게 —
            지금까지 /admin 으로 가는 길이 화면 어디에도 없었다.
            문구를 번역하지 않는 건 관리 도구라 의도한 것이다
            (app/[locale]/admin/layout.tsx 주석).

            이건 편의 장치일 뿐 보안 장치가 아니다. 실제 차단은 RLS 정책과
            /admin 레이아웃의 권한 검사가 한다 — 여기가 안 보여도 주소로
            들어갈 수 있고, 관리자가 아니면 그때 404 가 난다. */}
        <AdminOnly>
          <Link
            href="/admin"
            className="hidden border border-dashed border-amber px-[10px] py-[5px] font-mono text-[11.5px] tracking-tag text-amber transition-colors hover:bg-amber hover:text-on-amber sm:block"
          >
            ADMIN
          </Link>
        </AdminOnly>

        <MobileMenu items={items} />

        <ThemeToggle label={t("nav.toggleTheme")} />

        <LocaleSwitcher />

        <AuthButton />
      </div>
    </nav>
  );
}
