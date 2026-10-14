import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * OG 이미지 공통.
 *
 * 폰트는 파일에서 읽는다. satori 는 woff2 를 못 읽어서 Pretendard 동적
 * 서브셋(92조각)을 쓸 수 없고, 통짜 OTF 두 벌을 scripts/fonts.mjs 가
 * public/fonts/pretendard/og 로 복사해 둔다.
 *
 * 처음에는 사이트 주소로 fetch 해서 가져왔다. 그러면 안 된다 —
 * 배포된 함수가 자기 자신을 HTTP 로 부르는 셈이고, 배포 URL 이 보호되어
 * 있거나 별칭이 다르면 폰트 대신 HTML 을 받아 500 이 난다. 실제로 그랬다.
 * 파일로 읽으면 네트워크가 아예 없어서 그럴 여지가 없고 더 빠르다.
 *
 * public/ 은 함수 번들에 자동으로 들어가지 않는다.
 * next.config.ts 의 outputFileTracingIncludes 가 이 두 파일을 밀어 넣는다 —
 * 둘 중 하나만 고치면 배포에서만 깨진다.
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/** docs/DESIGN.md 의 값 그대로. 화면과 카드가 달라 보이면 안 된다. */
export const OG_COLORS = {
  bg: "#060606",
  ink: "#EDEAE4",
  mute: "#A8A29A",
  dim: "#837E75",
  line: "#2A2723",
  amber: "#E29B2E",
};

const FONT_DIR = join(process.cwd(), "public", "fonts", "pretendard", "og");

export async function ogFonts() {
  const [regular, bold] = await Promise.all([
    readFile(join(FONT_DIR, "Pretendard-Regular.otf")),
    readFile(join(FONT_DIR, "Pretendard-Bold.otf")),
  ]);

  return [
    { name: "Pretendard", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Pretendard", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}
