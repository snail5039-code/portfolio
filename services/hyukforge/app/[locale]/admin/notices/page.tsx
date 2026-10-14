import { Link } from "@/i18n/navigation";
import { listAllNotices, listNoticeEvents } from "@/lib/queries/admin-content";
import { NoticeRowActions } from "@/components/admin/NoticeRowActions";
import { NoticeHistory } from "@/components/admin/NoticeHistory";
import { locales } from "@/i18n/routing";
import { shortDate } from "@/lib/format";

/**
 * 공지 목록.
 *
 * 올리고 내리는 것을 여기서 한다. 전에는 상태를 바꾸려면 수정 화면에
 * 들어가 번역 10개가 딸린 폼을 통째로 다시 저장해야 했다 — 본문을 고칠
 * 생각이 없는데도 그랬다. 이제 줄마다 버튼이 붙어 있고, 무엇을 언제
 * 올렸다 내렸는지는 아래 기록에 쌓인다.
 *
 * 번역 진행률을 같이 보여주는 건 그대로다 — 어느 공지가 어느 언어까지
 * 채워졌는지 여기서 보이지 않으면 관리가 안 된다. (제품 목록과 같은 이유)
 */
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "발행", cls: "text-amber border-amber" },
  draft: { label: "초안", cls: "text-dim border-edge" },
  archived: { label: "보관", cls: "text-dim border-edge" },
};

export default async function AdminNotices() {
  // 목록과 기록을 같이 읽는다. 기록만 늦게 오면 화면이 두 번 그려진다.
  const [notices, events] = await Promise.all([
    listAllNotices(),
    listNoticeEvents({ limit: 20 }),
  ]);

  const count = (s: string) => notices.filter((n) => n.status === s).length;

  return (
    <main className="pt-8">
      <div className="mb-6 flex flex-wrap items-baseline gap-4">
        <h2 className="text-[19px] font-semibold">공지 {notices.length}개</h2>
        <span className="font-mono text-[12px] text-dim">
          올라간 것 <span className="text-amber">{count("published")}</span> · 초안{" "}
          {count("draft")} · 보관 {count("archived")}
        </span>
        <span className="-translate-y-[3px] min-w-10 flex-1 border-t border-line" />
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
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                {["제목", "상태", "번역", "발행", "수정", "올리기 · 내리기"].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`border-b border-edge px-3 py-[10px] font-mono text-[11px] font-normal uppercase tracking-label text-dim ${
                        i === 5 ? "text-right" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {notices.map((n) => (
                <tr key={n.id} className="group">
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <Link href={`/admin/notices/${n.id}`} className="block">
                      <b className="flex items-baseline gap-2 text-[14.5px] font-semibold">
                        {n.isPinned && (
                          <span className="shrink-0 border border-amber px-[5px] py-px font-mono text-[10px] tracking-tag text-amber">
                            고정
                          </span>
                        )}
                        {n.title}
                      </b>
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
                  <td className="border-b border-line px-3 py-[13px] transition-colors group-hover:bg-panel">
                    <NoticeRowActions
                      id={n.id}
                      status={n.status}
                      isPinned={n.isPinned}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <NoticeHistory events={events} title="최근 기록" />

      <p className="mt-5 text-[13px] leading-[1.7] text-dim">
        내리면 초안이 된다 — 목록·홈·검색·사이트맵에서 빠지고 본문은 그대로 남는다.
        보관도 보이지 않는 건 같지만 &quot;끝난 공지&quot;라는 뜻이라, 다시 올릴
        생각이 없는 것에 쓴다. 본문과 번역은 제목을 눌러 고친다.
      </p>
    </main>
  );
}
