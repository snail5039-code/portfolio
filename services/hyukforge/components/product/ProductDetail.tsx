import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AppWindow } from "./AppWindow";
import { Btn, IconBox, Label, SpecRow, Tag } from "@/components/ui";
import { ProductPreview } from "./ProductPreview";
import { RichParagraph } from "./RichText";
import { AdminLink } from "@/components/admin/AdminOnly";
import { fileSize, linkLabel, platformLabel, shortDate } from "@/lib/format";
import { imageUrl, isUnoptimized } from "@/lib/images";
import type { Product } from "@/lib/queries/products";
import type { ChangelogEntry } from "@/lib/queries/changelog";

/**
 * 제품 상세.
 *
 * 파는 게 소프트웨어니까 화면이 가장 크게 들어간다.
 * 설명보다 사양표가 위에 오는 이유는, 받으려는 사람이 제일 먼저 확인하는 게
 * "내 환경에서 돌아가나"이기 때문이다.
 */
export async function ProductDetail({
  product: p,
  history = [],
  locale,
}: {
  product: Product;
  history?: ChangelogEntry[];
  locale: string;
}) {
  const t = await getTranslations();
  const canDownload = p.kind === "download" && p.latest;

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      {/* 어디에 있는지 — 목록으로 돌아가는 길을 항상 열어둔다 */}
      <nav className="flex items-center gap-2 pb-6 pt-[52px] font-mono text-[12px] text-dim">
        <Link href="/products" className="transition-colors hover:text-amber">
          {t("section.products")}
        </Link>
        <span>/</span>
        {p.category && (
          <>
            <Link
              href={`/products?category=${p.category}`}
              className="transition-colors hover:text-amber"
            >
              {t(`category.${p.category}`)}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-mute">{p.name}</span>
        {/* 관리자에게만 보인다 */}
        <span className="ml-auto">
          <AdminLink href={`/${locale}/admin/products/${p.id}`}>수정</AdminLink>
        </span>
      </nav>

      <div className="grid gap-14 lg:grid-cols-[minmax(0,46fr)_minmax(0,54fr)]">
        <div>
          <div className="flex items-center gap-3">
            <IconBox letter={p.iconLetter} />
            <h1 className="text-[30px] font-bold tracking-[-0.025em]">{p.name}</h1>
          </div>

          {p.tagline && (
            <p className="mt-4 max-w-[40ch] text-[15px] text-mute">{p.tagline}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Tag
              slug={p.category}
              label={p.category ? t(`category.${p.category}`) : "—"}
            />
            {p.isFree && (
              <span className="font-mono text-tag tracking-tag text-amber">
                {t("product.free")}
              </span>
            )}
            <span className="border border-office px-2 py-1 font-mono text-tag tracking-tag text-office">
              {t(`product.implementation.${p.implementationStatus}`)}
            </span>
            <span className={`border px-2 py-1 font-mono text-tag tracking-tag ${
              p.deploymentStatus === "deployed"
                ? "border-amber text-amber"
                : "border-edge text-dim"
            }`}>
              {t(`product.deployment.${p.deploymentStatus}`)}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap gap-[10px]">
            {p.kind === "webapp" && p.externalUrl ? (
              <Btn href={p.externalUrl} external variant="primary">
                {t("product.open")} ↗
              </Btn>
            ) : canDownload ? (
              <Btn href={`/api/download/${p.latest!.id}`} unlocalized variant="primary">
                {t("product.download")} ↓
              </Btn>
            ) : p.kind === "source" && p.repoUrl ? (
              /* 소스만 공개한 제품은 받을 것이 없다. "곧 공개" 라고 적으면
                 오지 않을 것을 기다리게 만든다. 있는 것(저장소)으로 보낸다. */
              <Btn href={p.repoUrl} external variant="primary">
                {t("product.viewSource")} ↗
              </Btn>
            ) : (
              <Btn>{t("product.comingSoon")}</Btn>
            )}
          </div>

          {canDownload && (
            <p className="mt-4 text-[13px] text-dim">
              {t("product.loginRequired")}
            </p>
          )}

          <div className="mt-9 border-t border-line">
            {p.latest && (
              <SpecRow label={t("product.version")}>
                {p.latest.version} · {shortDate(p.latest.releasedAt)}
              </SpecRow>
            )}
            <SpecRow label={t("product.platform")}>
              {p.kind === "webapp" ? "Web" : platformLabel(p.platforms)}
            </SpecRow>
            {p.latest?.fileSize != null && (
              <SpecRow label={t("product.size")}>
                {fileSize(p.latest.fileSize)}
              </SpecRow>
            )}
            <SpecRow label={t("product.updated")}>
              {shortDate(p.updatedAt)}
            </SpecRow>
            <SpecRow label={t("product.implementation.label")}>
              {t(`product.implementation.${p.implementationStatus}`)}
            </SpecRow>
            <SpecRow label={t("product.deployment.label")}>
              {t(`product.deployment.${p.deploymentStatus}`)}
            </SpecRow>
            <SpecRow label={t("product.price")} accent={p.isFree}>
              {p.isFree ? t("product.free") : "—"}
            </SpecRow>
            {/* 열린 소스는 저장소로 보내고, 아니면 아니라고 적는다.
                줄을 숨기면 "안 적어둔 것"과 구분이 안 된다. */}
            <SpecRow label={t("product.source")}>
              {p.repoUrl ? (
                <a
                  href={p.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-amber"
                >
                  {linkLabel(p.repoUrl)} ↗
                </a>
              ) : (
                <span className="text-dim">{t("product.sourcePrivate")}</span>
              )}
            </SpecRow>
          </div>
        </div>

        <div>
          <AppWindow
            title={p.name}
            footLeft={p.latest ? `v${p.latest.version.replace(/^v/, "")}` : undefined}
            footRight={p.kind === "webapp" ? "Web" : platformLabel(p.platforms)}
            src={p.images[0] ? imageUrl(p.images[0].path) : undefined}
            unoptimized={p.images[0] ? isUnoptimized(p.images[0].path) : undefined}
            alt={p.images[0]?.alt ?? p.name}
            imageClassName={
              p.slug === "lastcall"
                ? "h-[460px] w-full object-contain p-3 sm:h-[560px] sm:p-5"
                : undefined
            }
          >
            {/* 스크린샷이 아직 없을 때만 이 자리가 쓰인다 */}
            <div className="grid min-h-[300px] place-items-center px-6 py-12 text-center">
              <Label>{t("preview.none")}</Label>
            </div>
          </AppWindow>
        </div>
      </div>

      <ProductPreview
        name={p.name}
        images={p.images}
        videoUrl={p.videoUrl}
        demoUrl={p.demoUrl}
        compactImages={p.slug === "lastcall"}
      />

      {p.description && (
        <section className="pt-[68px]">
          <div className="mb-6 flex items-baseline gap-4">
            <h2 className="text-[17px] font-semibold">{t("section.about")}</h2>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
          </div>
          {/* 마크다운 렌더링은 나중에. 지금은 문단 나누기·줄바꿈·주소 링크만 처리한다. */}
          <div className="max-w-[62ch] space-y-4 text-[15px] text-mute">
            {p.description.split("\n\n").map((para, i) => (
              <RichParagraph key={i} text={para} />
            ))}
          </div>
        </section>
      )}

      {p.requirements && (
        <section className="pt-[68px]">
          <div className="mb-6 flex items-baseline gap-4">
            <h2 className="text-[17px] font-semibold">
              {t("product.requirements")}
            </h2>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
          </div>
          <ul className="border-t border-line font-mono text-data">
            {p.requirements.split("\n").filter(Boolean).map((line) => (
              <li key={line} className="border-b border-line py-2 text-mute">
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="pt-[68px]">
          <div className="mb-6 flex items-baseline gap-4">
            <h2 className="text-[17px] font-semibold">
              {t("product.changelog")}
            </h2>
            <span className="-translate-y-[3px] flex-1 border-t border-line" />
          </div>
          <div className="border-t border-edge">
            {history.map((e) => (
              <div
                key={e.id}
                className="grid items-baseline gap-[18px] border-b border-line py-[13px] md:grid-cols-[104px_1fr]"
              >
                <time dateTime={e.date} className="font-mono text-data text-dim">
                  {shortDate(e.date)}
                </time>
                <span className="text-[14px] text-ink">{e.body}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
