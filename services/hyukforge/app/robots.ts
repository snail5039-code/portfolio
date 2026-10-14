import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, siteUrl } from "@/lib/site";

/**
 * robots.txt
 *
 * 개인 화면(내 서랍)·관리자·목업은 막는다. 막는다고 안전해지는 건 아니다 —
 * 실제 차단은 RLS 와 /admin 레이아웃의 권한 검사가 한다.
 * 여기서 막는 건 검색 결과에 뜨지 않게 하려는 것뿐이다.
 *
 * 글쓰기 화면도 막는다. 로그인해야 쓸 수 있는데 색인되면
 * 검색에서 들어온 사람이 로그인 안내만 보게 된다.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        ...PRIVATE_PATHS.map((p) => `${p}/`),
        // 언어 접두사가 붙는 경로는 와일드카드로 잡는다 (/ko/admin, /en/me …)
        ...PRIVATE_PATHS.filter((p) => !["/api", "/auth"].includes(p)).map(
          (p) => `/*${p}/`,
        ),
        "/*/board/*/new",
        // 검색 결과. 검색어마다 다른 주소가 생기는데 내용은 다른 화면의 조각들이다.
        // 색인되면 같은 내용이 중복 등록된다 (app/[locale]/search/page.tsx 의 noindex 와 같은 이유).
        "/*/search",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
