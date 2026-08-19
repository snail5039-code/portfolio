import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JetBrains_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing, locales } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import "../globals.css";

// 모노스페이스는 버전·용량·날짜·라벨에 쓴다. 워크벤치 톤의 핵심.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

type Params = { locale: string };

/** 10개 언어를 모두 정적 생성한다. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });

  const base = siteUrl();

  return {
    // 상대 주소로 적은 OG·canonical 을 절대 주소로 펼치는 기준이다.
    // 없으면 Next 가 경고를 내고 localhost 로 붙는다.
    metadataBase: new URL(base),
    title: { default: t("title"), template: `%s · ${t("title")}` },
    description: t("description"),
    alternates: {
      canonical: `${base}/${locale}`,
      // 같은 문서의 번역본끼리 서로를 가리키게 한다 (sitemap 과 같은 규칙)
      languages: {
        ...Object.fromEntries(locales.map((l) => [l, `${base}/${l}`])),
        "x-default": `${base}/${routing.defaultLocale}`,
      },
      // 피드 리더가 주소만 보고 찾을 수 있게 head 에 걸어둔다
      types: { "application/rss+xml": `${base}/rss.xml` },
    },
    openGraph: {
      type: "website",
      siteName: t("title"),
      locale,
      url: `${base}/${locale}`,
      title: t("title"),
      description: t("description"),
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Params>;
}) {
  // Next.js 16에서 params는 Promise다.
  const { locale } = await params;

  // [locale]은 모르는 경로까지 다 받아내는 자리라(/unknown.txt 같은),
  // 지원 언어가 아니면 여기서 걸러야 한다.
  if (!hasLocale(routing.locales, locale)) notFound();

  // 이걸 빼면 하위 페이지가 전부 동적 렌더링으로 떨어진다.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={jetbrains.variable}>
      <head>
        {/* Pretendard는 구글 폰트에 없어 직접 호스팅한다.
            scripts/fonts.mjs 가 node_modules 에서 public/fonts 로 복사한다.
            동적 서브셋이라 브라우저가 실제로 쓰는 글자 범위만 받는다.

            next/font/local 로 바꾸지 않는다. 재보고 내린 결론이다.
            이 CSS 는 unicode-range 가 붙은 @font-face 92개고, 한글 페이지 하나가
            그중 16개 약 375KB 만 받는다. next/font/local 의 src 는 unicode-range 를
            표현할 수 없어서 통짜 변수 폰트(2.0MB)를 통째로 넘기게 된다 — 5배 이상 손해다.
            (next/font/google 과 달리 로컬 폰트는 자동 서브셋도 하지 않는다)

            그래서 규칙을 끈다. 규칙이 틀린 게 아니라 이 경우가 예외다. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendard.css" />
      </head>
      <body>
        {/* 서버 컴포넌트에서 렌더되면 locale과 messages를 알아서 받는다 */}
        <NextIntlClientProvider>
          <Nav />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
