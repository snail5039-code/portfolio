import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /**
   * OG 폰트를 페이지 함수에서 뺀다.
   *
   * lib/og.ts 가 `path.join(process.cwd(), …)` 로 폰트를 읽는데, 트레이서가
   * 그 꼴을 알아보고 파일을 자동으로 포함시킨다. 그래서 include 는 필요 없다.
   *
   * 문제는 `app/[locale]/opengraph-image.tsx` 가 하위 모든 페이지의 상속
   * 메타데이터라는 점이다. 그 모듈이 닿는 곳마다 3MB 짜리 OTF 두 벌이 따라붙어
   * 페이지 함수 34개에 복제됐다. 실제로 쓰는 건 opengraph-image 라우트뿐이라
   * 페이지 쪽에서만 걷어낸다.
   */
  outputFileTracingExcludes: {
    "**/page": ["./public/fonts/pretendard/og/*.otf"],
  },
};

export default withNextIntl(nextConfig);
