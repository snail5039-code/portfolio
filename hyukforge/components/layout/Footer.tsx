import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function Footer() {
  const t = await getTranslations();

  return (
    <footer className="mx-auto mt-[86px] flex max-w-page flex-wrap justify-between gap-5 border-t border-line px-gutter pb-14 pt-[30px] font-mono text-[12px] text-dim">
      <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
      <div className="flex gap-[18px]">
        <a
          href="https://github.com/snail5039-code"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-colors hover:text-amber"
        >
          GitHub
        </a>
        <a
          href="mailto:snail5039@gmail.com"
          className="transition-colors hover:text-amber"
        >
          {t("footer.contact")}
        </a>
        <Link href="/legal/privacy" className="transition-colors hover:text-amber">
          {t("footer.privacy")}
        </Link>
        <Link href="/legal/terms" className="transition-colors hover:text-amber">
          {t("footer.terms")}
        </Link>
      </div>
    </footer>
  );
}
