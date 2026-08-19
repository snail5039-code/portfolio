import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";
import { OG_COLORS, OG_CONTENT_TYPE, OG_SIZE, ogFonts } from "@/lib/og";

/**
 * 제품이 아닌 화면(홈·게시판·공지…)을 공유했을 때 뜨는 카드.
 *
 * 제품 카드와 같은 규칙이되 값이 없으니 소개 문장을 쓴다.
 * 제품 상세는 자기 카드를 따로 가진다 (products/[slug]/opengraph-image.tsx).
 */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "HyukForge";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const fonts = await ogFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: OG_COLORS.bg,
          padding: "72px 80px",
          fontFamily: "Pretendard",
        }}
      >
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
            marginTop: 36,
            fontSize: 64,
            fontWeight: 700,
            color: OG_COLORS.ink,
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {t("description")}
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 40,
            borderTop: `1px solid ${OG_COLORS.line}`,
            paddingTop: 24,
            fontSize: 26,
            color: OG_COLORS.dim,
          }}
        >
          hyukforge.vercel.app
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
