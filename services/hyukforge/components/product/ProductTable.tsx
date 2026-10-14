import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { IconBox, Tag } from "@/components/ui";
import { fileSize, platformLabel, repoHost, shortDate } from "@/lib/format";
import type { Product } from "@/lib/queries/products";

/**
 * 제품 목록. 카드를 4개씩 반복하지 않고 표로 낸다.
 * 표는 소프트웨어 카탈로그의 언어이고, 카드 그리드는 쇼핑몰의 언어다. (docs/DESIGN.md 5장)
 *
 * 모바일에서도 카드로 바꾸지 않는다. 가로 스크롤이 정직하다.
 */
export async function ProductTable({ products }: { products: Product[] }) {
  const t = await getTranslations();

  if (!products.length) {
    return (
      <p className="border-y border-line py-10 text-center text-[13.5px] text-dim">
        {t("common.empty")}
      </p>
    );
  }

  const heads = [
    t("product.name"),
    t("product.category"),
    t("product.version"),
    t("product.size"),
    t("product.updated"),
    t("product.status"),
    t("product.source"),
    "",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
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
          {products.map((p) => (
            <tr key={p.id} className="group">
              <td className="border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                <Link href={`/products/${p.slug}`} className="flex items-center gap-3">
                  <IconBox letter={p.iconLetter} />
                  <span>
                    <b className="block text-[14.5px] font-semibold">{p.name}</b>
                    {p.tagline && (
                      <small className="text-[12px] text-dim">{p.tagline}</small>
                    )}
                  </span>
                </Link>
              </td>

              <td className="border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                <Tag
                  slug={p.category}
                  label={p.category ? t(`category.${p.category}`) : "—"}
                />
              </td>

              <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                {p.latest?.version ?? "—"}
              </td>

              <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                {p.kind === "webapp"
                  ? platformLabel(["web"])
                  : fileSize(p.latest?.fileSize ?? null)}
              </td>

              <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                {shortDate(p.updatedAt)}
              </td>

              <td className="border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                <div className="flex min-w-max flex-col items-start gap-1 font-mono text-[10px] tracking-tag">
                  <span className="text-office">
                    {t(`product.implementation.${p.implementationStatus}`)}
                  </span>
                  <span className={p.deploymentStatus === "deployed" ? "text-amber" : "text-dim"}>
                    {t(`product.deployment.${p.deploymentStatus}`)}
                  </span>
                </div>
              </td>

              <td className="u-data border-b border-line px-3 py-[15px] transition-colors group-hover:bg-panel">
                {p.repoUrl ? (
                  <a
                    href={p.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap text-dim transition-colors hover:text-amber"
                  >
                    {repoHost(p.repoUrl)} ↗
                  </a>
                ) : (
                  <span className="text-dim">{t("product.sourcePrivate")}</span>
                )}
              </td>

              <td className="border-b border-line px-3 py-[15px] text-right transition-colors group-hover:bg-panel">
                <DownloadCell product={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function DownloadCell({ product: p }: { product: Product }) {
  const t = await getTranslations();
  const cls = "whitespace-nowrap font-mono text-[12px]";

  // 웹앱은 받는 게 아니라 여는 것이다. 다운로드 기록을 남기지 않는다.
  if (p.kind === "webapp" && p.externalUrl) {
    return (
      <a
        href={p.externalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} text-amber hover:underline`}
      >
        {t("product.open")} ↗
      </a>
    );
  }

  // 소스만 공개한 제품은 받을 것이 없다. 기다리라고 하지 않고 저장소로 보낸다.
  if (p.kind === "source" && p.repoUrl) {
    return (
      <a
        href={p.repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${cls} text-amber hover:underline`}
      >
        {t("product.viewSource")} ↗
      </a>
    );
  }

  // 릴리스가 없으면 아직 받을 수 없다.
  if (!p.latest) {
    return <span className={`${cls} text-dim`}>{t("product.comingSoon")}</span>;
  }

  return (
    <Link
      href={`/products/${p.slug}`}
      className={`${cls} text-amber hover:underline`}
    >
      {t("product.download")} ↓
    </Link>
  );
}
