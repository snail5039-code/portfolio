import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IconBox, Tag } from "@/components/ui";
import { SearchBox } from "@/components/search/SearchBox";
import { fileSize, platformLabel, shortDate } from "@/lib/format";
import type { Product } from "@/lib/queries/products";

/**
 * 받을 수 있는 것만 모아 보여주는 표.
 * 제품 목록과 달리 설명을 덜어내고 버전·용량·환경을 앞세운다 —
 * 여기 오는 사람은 이미 뭘 받을지 정한 상태다.
 */
export async function DownloadsPage({
  products,
  search = "",
}: {
  products: Product[];
  /** 검색어. 목록은 이미 걸러진 채로 온다 — 여기서는 표시에만 쓴다 */
  search?: string;
}) {
  const t = await getTranslations();

  // 웹앱은 받는 게 아니라 여는 것이라 여기 나오지 않는다.
  const downloadable = products.filter((p) => p.kind !== "webapp" && p.latest);

  const heads = [
    t("product.name"),
    t("product.category"),
    t("product.version"),
    t("product.platform"),
    t("product.size"),
    t("product.updated"),
    "",
  ];

  return (
    <main className="mx-auto max-w-page px-gutter pb-10">
      <header className="border-b border-line pb-7 pt-[68px]">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">
          {t("section.downloads")}
        </h1>
        <p className="mt-2 text-[14px] text-mute">
          {t("product.loginRequired")}
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3 py-6">
        <span className="ml-auto">
          <SearchBox path="/downloads" initial={search} />
        </span>
      </div>

      {downloadable.length === 0 ? (
        <p className="border-b border-line py-16 text-center text-[13.5px] text-dim">
          {search ? t("search.none", { term: search }) : t("common.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {heads.map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-edge px-3 py-[10px] text-left font-mono text-[11px] font-normal uppercase tracking-label text-dim"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {downloadable.map((p) => (
                <tr key={p.id} className="group">
                  <td className="border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    <Link
                      href={`/products/${p.slug}`}
                      className="flex items-center gap-3"
                    >
                      <IconBox letter={p.iconLetter} />
                      <b className="text-[14.5px] font-semibold">{p.name}</b>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    <Tag
                      slug={p.category}
                      label={p.category ? t(`category.${p.category}`) : "—"}
                    />
                  </td>
                  <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    {p.latest!.version}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    {platformLabel(p.platforms)}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    {fileSize(p.latest!.fileSize)}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                    {shortDate(p.latest!.releasedAt)}
                  </td>
                  <td className="border-b border-line px-3 py-[15px] text-right transition-colors group-hover:bg-panel">
                    {/* 언어 접두사를 붙이면 안 된다 — API 라우트는 [locale] 밖에 있다.
                        next-intl 의 Link 를 쓰면 /ko/api/... 가 되어 404 다. */}
                    <a
                      href={`/api/download/${p.latest!.id}`}
                      className="whitespace-nowrap font-mono text-[12px] text-amber hover:underline"
                    >
                      {t("product.download")} ↓
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
