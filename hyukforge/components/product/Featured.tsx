import { getTranslations } from "next-intl/server";
import { Btn, Label, SpecRow } from "@/components/ui";
import { AppWindow } from "./AppWindow";
import { fileSize, platformLabel, shortDate } from "@/lib/format";
import { imageUrl, isUnoptimized } from "@/lib/images";
import type { Product } from "@/lib/queries/products";

/**
 * 대표 제품 하나만 크게. 나머지는 아래 표로 간다.
 * 모든 카드를 같은 크기로 두면 위계가 사라진다. (docs/DESIGN.md 5장)
 */
export async function Featured({
  product: p,
  shotIndex = 0,
}: {
  product: Product;
  /** 몇 번째 스크린샷을 쓸지. 홈은 히어로가 첫 장을 쓰므로 다음 장을 넘긴다. */
  shotIndex?: number;
}) {
  const t = await getTranslations();
  // 상세와 같은 규칙으로 스크린샷을 쓴다. 이걸 안 넘겨서 스크린샷을 올려도
  // 홈은 계속 "준비 중" 이었다. (lib/images.ts)
  const shot = p.images[shotIndex] ?? p.images[0];

  return (
    <article className="mb-[2px] grid border border-edge lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)]">
      <div className="border-b border-edge bg-[#0C0C0B] p-[22px] lg:border-b-0 lg:border-r">
        <AppWindow
          title={p.name}
          footLeft={p.latest ? `v${p.latest.version.replace(/^v/, "")}` : undefined}
          footRight={p.platforms.length ? platformLabel(p.platforms) : undefined}
          src={shot ? imageUrl(shot.path) : undefined}
          unoptimized={shot ? isUnoptimized(shot.path) : undefined}
          alt={shot?.alt ?? p.name}
        >
          {/* 스크린샷이 없을 때만 이 자리가 쓰인다 */}
          <div className="grid min-h-[220px] place-items-center px-6 py-10 text-center">
            <span className="u-label">{t("preview.none")}</span>
          </div>
        </AppWindow>
      </div>

      <div className="px-[30px] pb-6 pt-[30px]">
        <Label>{t("home.featured")}</Label>
        <h3 className="mb-[10px] mt-3 text-[23px] font-bold tracking-[-0.02em]">
          {p.name}
        </h3>
        {p.tagline && (
          <p className="max-w-[38ch] text-[14px] text-mute">{p.tagline}</p>
        )}

        <div className="mt-6 border-t border-line">
          {p.latest && (
            <SpecRow label={t("product.version")}>
              {p.latest.version} · {shortDate(p.latest.releasedAt)}
            </SpecRow>
          )}
          {p.platforms.length > 0 && (
            <SpecRow label={t("product.platform")}>
              {platformLabel(p.platforms)}
            </SpecRow>
          )}
          {p.latest?.fileSize != null && (
            <SpecRow label={t("product.size")}>
              {fileSize(p.latest.fileSize)}
            </SpecRow>
          )}
          <SpecRow label={t("product.price")} accent={p.isFree}>
            {p.isFree ? t("product.free") : "—"}
          </SpecRow>
        </div>

        <div className="mt-[30px] flex flex-wrap gap-[10px]">
          {p.kind === "webapp" && p.externalUrl ? (
            <Btn href={p.externalUrl} external variant="primary">
              {t("product.open")} ↗
            </Btn>
          ) : (
            <Btn href={`/products/${p.slug}`} variant="primary">
              {p.latest ? t("product.download") : t("product.comingSoon")}
            </Btn>
          )}
          <Btn href={`/products/${p.slug}`}>{t("product.changelog")}</Btn>
        </div>
      </div>
    </article>
  );
}
