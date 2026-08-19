import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Label } from "@/components/ui";
import {
  AUTHORITATIVE_LOCALE,
  LEGAL_DOCS,
  getLegalDoc,
  isLegalDoc,
} from "@/lib/legal";

/**
 * 개인정보처리방침 · 이용약관.
 *
 * 본문은 lib/legal.ts 에 있다. 화면 문구가 아니라 문서라서
 * messages/*.json 에 넣지 않았다 — 이유는 그 파일 주석에 적어뒀다.
 *
 * 위에 요약을 먼저 놓는다. 아무도 안 읽는 문서를 놓고 "동의한 것으로 본다"고
 * 하는 대신, 중요한 네 가지는 먼저 눈에 들어오게 한다.
 */
export const revalidate = 3600;

type Params = { locale: string; doc: string };

export function generateStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, doc } = await params;
  if (!isLegalDoc(doc)) return {};
  return { title: getLegalDoc(doc, locale).title };
}

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { locale, doc } = await params;
  if (!isLegalDoc(doc)) notFound();

  setRequestLocale(locale);
  const t = await getTranslations();
  const document = getLegalDoc(doc, locale);

  const summary = [t("legal.point1"), t("legal.point2"), t("legal.point3"), t("legal.point4")];

  return (
    <main className="mx-auto max-w-page px-gutter pb-16">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {document.title}
        </h1>
        <p className="mt-3 font-mono text-[12px] text-dim">
          {t("legal.effective")} {document.effective}
        </p>
      </header>

      <div className="max-w-[68ch] pt-9">
        {/* 기준본이 아닌 언어로 보고 있으면 그 사실을 먼저 알린다 */}
        {locale !== AUTHORITATIVE_LOCALE && (
          <p className="mb-8 border border-edge px-5 py-4 text-[13.5px] text-mute">
            {t("legal.authoritative")}
          </p>
        )}

        <section className="border border-edge px-5 py-5">
          <Label>{t("legal.summary")}</Label>
          <ul className="mt-3 space-y-2 text-[14px] text-mute">
            {summary.map((s) => (
              <li key={s} className="border-l border-edge pl-3">
                {s}
              </li>
            ))}
          </ul>
        </section>

        {document.sections.map((s) => (
          <section key={s.heading} className="pt-10">
            <h2 className="text-[16px] font-semibold">{s.heading}</h2>
            <div className="mt-3 space-y-[10px]">
              {s.body.map((line, i) =>
                line.startsWith("· ") ? (
                  <p
                    key={i}
                    className="border-l border-edge pl-3 text-[14.5px] leading-[1.75] text-mute"
                  >
                    {line.slice(2)}
                  </p>
                ) : (
                  <p key={i} className="text-[14.5px] leading-[1.75] text-mute">
                    {line}
                  </p>
                ),
              )}
            </div>
          </section>
        ))}

        <p className="mt-12 border-t border-line pt-6 text-[13px] text-dim">
          {t("footer.contact")} ·{" "}
          <a
            href="mailto:snail5039@gmail.com"
            className="font-mono text-amber hover:underline"
          >
            snail5039@gmail.com
          </a>
        </p>
      </div>
    </main>
  );
}
