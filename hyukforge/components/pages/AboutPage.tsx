import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Label } from "@/components/ui";

/**
 * 소개.
 *
 * 어두운 방의 개발자 스톡 사진과 기술 스택 로고 그리드를 쓰지 않는다.
 * 둘 다 내용이 0이다. 대신 1인칭 문장과 "지금 만들고 있는 것"을 둔다.
 * (docs/DESIGN.md 1장)
 *
 * 본문은 messages/*.json 의 about.* 에 있다. 여기 직접 쓰지 않는다 —
 * 그러면 10개 언어를 깔아놓고 이 페이지만 한국어로 남는다.
 */
export async function AboutPage({
  wip,
}: {
  wip: { name: string; note: string }[];
}) {
  const t = await getTranslations();

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="pb-10 pt-[68px]">
        {/* 로고는 --color-bg 위에서만 쓴다. panel 위에 올리면 사각형이 드러난다. */}
        <Image
          src="/brand/lockup.trim.png"
          alt="HyukForge — Independent Software Studio"
          width={976}
          height={518}
          className="w-full max-w-[360px]"
        />
      </header>

      <div className="grid gap-16 border-t border-line pt-12 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]">
        <div className="space-y-[14px] text-[15px] text-mute">
          <p>
            <strong className="font-semibold text-ink">
              {t("about.lead1Strong")}
            </strong>{" "}
            {t("about.lead1")}
          </p>
          <p>{t("about.lead2")}</p>
          <p>{t("about.lead3")}</p>
          <p className="pt-2 text-[13px] text-dim">
            {t("about.contact")} ·{" "}
            <a
              href="mailto:snail5039@gmail.com"
              className="font-mono text-amber hover:underline"
            >
              snail5039@gmail.com
            </a>
          </p>
        </div>

        <aside className="border border-edge px-6 py-[22px]">
          <Label>{t("home.wip")}</Label>
          <div className="mt-[14px]">
            {wip.map((w) => (
              <div
                key={w.name}
                className="flex justify-between gap-4 border-b border-line py-[10px] text-[13.5px] last:border-b-0"
              >
                <span className="text-ink">{w.name}</span>
                <span className="font-mono text-[12px] text-dim">{w.note}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
