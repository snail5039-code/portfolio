import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { AuthButton } from "./AuthButton";
import { MobileMenu } from "./MobileMenu";
import { NotificationBell } from "./NotificationBell";

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
        {/* 마크는 28px 미만으로 줄이지 않는다 — 사선 디테일이 뭉개진다 */}
        <Link href="/" className="mr-auto flex items-center gap-[10px]">
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

        <MobileMenu items={items} />

        <LocaleSwitcher />

        <AuthButton />
      </div>
    </nav>
  );
}
