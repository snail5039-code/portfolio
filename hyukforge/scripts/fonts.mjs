/**
 * Pretendard를 직접 호스팅하기 위해 node_modules에서 public으로 복사한다.
 *
 * 왜 CDN을 안 쓰나
 *  · 외부 도메인에 의존하면 그쪽이 느려지거나 막히면 글꼴이 깨진다
 *  · 방문자 IP가 제3자에게 넘어간다
 *
 * 왜 통짜 변수 폰트(2.0MB)가 아니라 동적 서브셋인가
 *  · 서브셋은 92조각으로 나뉘어 있고 브라우저가 실제로 쓰는 글자 범위만 받는다
 *  · 한글 페이지 하나에 보통 150~250KB. 통짜는 2.0MB를 전부 받는다
 *
 * 복사본은 커밋하지 않는다 (.gitignore). 설치·빌드 때마다 다시 만든다.
 *
 *   node scripts/fonts.mjs
 */

import { cpSync, copyFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";

const SRC = "node_modules/pretendard/dist/web/variable";
const OUT = "public/fonts/pretendard";

if (!existsSync(SRC)) {
  console.error("pretendard 패키지가 없습니다. npm install 을 먼저 실행하세요.");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

// CSS 안의 url()이 ./woff2-dynamic-subset/... 이라 둘을 나란히 둬야 한다.
copyFileSync(
  `${SRC}/pretendardvariable-dynamic-subset.css`,
  `${OUT}/pretendard.css`,
);
cpSync(`${SRC}/woff2-dynamic-subset`, `${OUT}/woff2-dynamic-subset`, {
  recursive: true,
});

// OG 이미지용 정적 폰트.
// satori(next/og)는 woff2 를 못 읽는다 — otf/ttf/woff 만 된다.
// 동적 서브셋은 unicode-range 로 나뉜 92조각이라 그쪽도 쓸 수 없어서
// 통짜 OTF 두 벌을 따로 둔다. 브라우저에는 안 나가고 OG 생성 때만 읽는다.
const OG_SRC = "node_modules/pretendard/dist/public/static";
mkdirSync(`${OUT}/og`, { recursive: true });
for (const face of ["Pretendard-Regular.otf", "Pretendard-Bold.otf"]) {
  copyFileSync(`${OG_SRC}/${face}`, `${OUT}/og/${face}`);
}

const files = readdirSync(`${OUT}/woff2-dynamic-subset`);
const total = files.reduce(
  (sum, f) => sum + statSync(`${OUT}/woff2-dynamic-subset/${f}`).size,
  0,
);

console.log(
  `Pretendard 복사 완료 — 서브셋 ${files.length}개, 합계 ${(total / 1048576).toFixed(1)}MB`,
);
console.log(`  ${OUT}/pretendard.css`);
console.log(`  ${OUT}/og/ — OG 이미지용 OTF 2벌`);
