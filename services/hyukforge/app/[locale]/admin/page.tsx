import { Link } from "@/i18n/navigation";
import { listAllProducts } from "@/lib/queries/admin";
import { shortDate } from "@/lib/format";

/**
 * 제품 목록. 번역 진행률을 같이 보여준다 —
 * 어느 제품이 어느 언어까지 채워졌는지 여기서 보이지 않으면 관리가 안 된다.
 */
export default async function AdminProducts() {
  const products = await listAllProducts();

  const STATUS: Record<string, { label: string; cls: string }> = {
    published: { label: "발행", cls: "text-amber border-amber" },
    draft: { label: "초안", cls: "text-dim border-edge" },
    archived: { label: "보관", cls: "text-dim border-edge" },
  };

  return (
    <main className="pt-8">
      <div className="mb-6 flex items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">제품 {products.length}개</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        <Link
          href="/admin/products/new"
          className="border border-amber bg-amber px-4 py-[9px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi"
        >
          + 새 제품
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="border-y border-line py-16 text-center text-[13.5px] text-dim">
          아직 제품이 없습니다. 위의 새 제품으로 시작하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                {["이름", "상태", "분류", "번역", "릴리스", "받은 수", "수정", ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="border-b border-edge px-3 py-[10px] text-left font-mono text-[11px] font-normal uppercase tracking-label text-dim"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="group">
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <Link href={`/admin/products/${p.id}`} className="block">
                      <b className="text-[14.5px] font-semibold">{p.name}</b>
                      <small className="block font-mono text-[12px] text-dim">
                        {p.slug}
                      </small>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <span
                      className={`border px-2 py-[3px] font-mono text-tag tracking-tag ${STATUS[p.status].cls}`}
                    >
                      {STATUS[p.status].label}
                    </span>
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {p.category ?? "—"}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {/* 번역이 ko+en 도 안 됐으면 눈에 띄게 */}
                    <span
                      className={`font-mono text-data ${p.filled < 2 ? "text-games" : "text-mute"}`}
                    >
                      {p.filled}/{p.total}
                    </span>
                    {p.reviewed > 0 && (
                      <span className="ml-2 font-mono text-[11px] text-dim">
                        검수 {p.reviewed}
                      </span>
                    )}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {p.releaseCount || "—"}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {p.downloadCount.toLocaleString()}
                  </td>
                  <td className="u-data border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    {shortDate(p.updatedAt)}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] text-right transition-colors group-hover:bg-panel">
                    <Link
                      href={`/admin/products/${p.id}`}
                      className="whitespace-nowrap font-mono text-[12px] text-amber hover:underline"
                    >
                      수정
                    </Link>
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
