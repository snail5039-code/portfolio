import { listChangelog } from "@/lib/queries/changelog";
import { defaultLocale } from "@/i18n/routing";
import { siteUrl } from "@/lib/site";

/**
 * 개발 기록 RSS.
 *
 * 공지가 아니라 개발 기록을 낸다. 공지는 어쩌다 한 번이고, 매주 쌓이는 건
 * "무엇을 고쳤다" 쪽이다. 1인 스튜디오에서 그 빈도가 곧 신뢰의 근거라
 * 구독으로 따라올 수 있게 한다. (components/pages/ChangelogPage.tsx 주석)
 *
 * 언어는 기본 언어(ko) 하나만 낸다. 10개 언어로 피드를 나누면 같은 항목이
 * 10벌로 돌아다니고, 구독자는 어느 걸 받아야 할지 알 수 없다.
 *
 * 개발 기록에는 고유 주소가 없다 — 목록 화면의 한 줄이다.
 * 그래서 link 는 목록을 가리키고 guid 는 항목 id 를 쓴다(isPermaLink=false).
 */
export const revalidate = 3600;

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const base = siteUrl();
  const entries = await listChangelog(defaultLocale, 50).catch(() => []);
  const listUrl = `${base}/${defaultLocale}/changelog`;

  const items = entries
    .map((e) => {
      const title = e.productName
        ? `${e.productName} — ${e.date}`
        : `${e.date}`;
      const link = e.productSlug
        ? `${base}/${defaultLocale}/products/${e.productSlug}`
        : listUrl;
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">${escapeXml(e.id)}</guid>
      <pubDate>${new Date(`${e.date}T00:00:00Z`).toUTCString()}</pubDate>
      <description>${escapeXml(e.body)}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>HyukForge — 개발 기록</title>
    <link>${escapeXml(listUrl)}</link>
    <description>고친 것과 아직 못 고친 것을 그대로 적습니다.</description>
    <language>${defaultLocale}</language>
    <atom:link href="${escapeXml(`${base}/rss.xml`)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
