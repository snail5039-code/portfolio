import { ImageResponse } from "next/og";
import { getProduct } from "@/lib/queries/products";
import { OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, ogFonts } from "@/lib/og";
import { fileSize, platformLabel } from "@/lib/format";

/**
 * 제품 링크를 공유했을 때 뜨는 카드.
 *
 * 장식을 넣지 않는다. 화면과 같은 규칙 — 1px 선과 여백, 앰버는 한 곳만.
 * 대신 실제 값을 넣는다. 이름·한 줄 소개·버전·환경·용량.
 * (docs/DESIGN.md "장식을 더해서 좋아 보이게 하지 말고, 진짜 정보를 넣는다")
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "HyukForge";

export default async function Image({
  params,
}: {
  // Next 16 에서 params 는 Promise 다
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const product = await getProduct(slug, locale).catch(() => null);
  const fonts = await ogFonts();

  const name = product?.name ?? slug;
  const tagline = product?.tagline ?? "";
  const latest = product?.latest;

  const specs = [
    latest?.version,
    product ? platformLabel(product.platforms) : null,
    latest?.fileSize != null ? fileSize(latest.fileSize) : null,
  ].filter(Boolean) as string[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: OG_COLORS.bg,
          padding: "72px 80px",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 4,
              color: OG_COLORS.amber,
              fontWeight: 700,
            }}
          >
            HYUKFORGE
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 76,
              fontWeight: 700,
              color: OG_COLORS.ink,
              lineHeight: 1.15,
            }}
          >
            {name}
          </div>

          {tagline && (
            <div
              style={{
                display: "flex",
                marginTop: 24,
                fontSize: 30,
                color: OG_COLORS.mute,
                lineHeight: 1.4,
              }}
            >
              {tagline.length > 70 ? `${tagline.slice(0, 70)}…` : tagline}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            borderTop: `1px solid ${OG_COLORS.line}`,
            paddingTop: 28,
            fontSize: 26,
            color: OG_COLORS.dim,
          }}
        >
          {specs.map((s) => (
            <div key={s} style={{ display: "flex" }}>
              {s}
            </div>
          ))}
          <div style={{ display: "flex", marginLeft: "auto", color: OG_COLORS.amber }}>
            {product?.isFree ? "무료" : ""}
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
