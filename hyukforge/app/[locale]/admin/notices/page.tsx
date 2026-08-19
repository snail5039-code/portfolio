import { Link } from "@/i18n/navigation";
import { listAllNotices } from "@/lib/queries/admin-content";
import { locales } from "@/i18n/routing";
import { shortDate } from "@/lib/format";

/**
 * 공지 목록. 번역 진행률을 같이 보여준다 —
 * 어느 공지가 어느 언어까지 채워졌는지 여기서 보이지 않으면 관리가 안 된다.
 * (제품 목록과 같은 이유)
 */
export default async function AdminNotices() {
  const notices = await listAllNotices();

  const STATUS: Record<string, { label: string; cls: string }> = {
    published: { label: "발행", cls: "text-amber border-amber" },
    draft: { label: "초안", cls: "text-dim border-edge" },
    archived: { label: "보관", cls: "text-dim border-edge" },
  };

  return (
    <main className="pt-8">
      <div className="mb-6 flex items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">공지 {notices.length}개</h2>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        <Link
          href="/admin/notices/new"
          className="border border-amber bg-amber px-4 py-[9px] font-mono text-[12px] font-semibold tracking-btn text-on-amber transition-colors hover:bg-amber-hi"
        >
          + 새 공지
        </Link>
      </div>

      {notices.length === 0 ? (
        <p className="border-y border-line py-16 text-center text-[13.5px] text-dim">
          아직 공지가 없습니다. 위의 새 공지로 시작하세요.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr>
                {["제목", "상태", "고정", "번역", "발행", "수정", ""].map((h, i) => (
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
              {notices.map((n) => (
                <tr key={n.id} className="group">
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <Link href={`/admin/notices/${n.id}`} className="block">
                      <b className="text-[14.5px] font-semibold">{n.title}</b>
                      <small className="block font-mono text-[12px] text-dim">
                        {n.slug}
                      </small>
                    </Link>
                  </td>
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <span
                      className={`border px-2 py-[2px] font-mono text-[11px] tracking-tag ${STATUS[n.status].cls}`}
                    >
                      {STATUS[n.status].label}
                    </span>
                  </td>
                  <td className="border-b border-line px-3 py-[13px] font-mono text-[12px] transition-colors group-hover:bg-panel">
                    {n.isPinned ? (
                      <span className="text-amber">고정</span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] font-mono text-[12px] text-mute transition-colors group-hover:bg-panel">
                    {n.filled} / {locales.length}
                    {n.reviewed > 0 && (
                      <span className="ml-2 text-dim">검수 {n.reviewed}</span>
                    )}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] font-mono text-[12px] text-mute transition-colors group-hover:bg-panel">
                    {n.publishedAt ? shortDate(n.publishedAt) : "—"}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] font-mono text-[12px] text-dim transition-colors group-hover:bg-panel">
                    {shortDate(n.updatedAt)}
                  </td>
                  <td className="border-b border-line px-3 py-[13px] text-right transition-colors group-hover:bg-panel">
                    <Link
                      href={`/admin/notices/${n.id}`}
                      className="font-mono text-[12px] text-amber hover:underline"
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
