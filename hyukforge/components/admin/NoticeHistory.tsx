import { Link } from "@/i18n/navigation";
import { stamp } from "@/lib/format";
import type { NoticeEvent, NoticeEventAction } from "@/lib/queries/admin-content";

/**
 * 공지를 언제 올렸다 내렸는지.
 *
 * 공지 행에는 지금 상태만 있다. 발행일(published_at)도 마지막으로 올린 시각
 * 하나뿐이라 내린 기록은 어디에도 남지 않았다. 여기가 그 자리다.
 *
 * 목록 화면에서는 전체를, 수정 화면에서는 그 공지 것만 보여준다.
 */
const LABEL: Record<NoticeEventAction, { text: string; cls: string }> = {
  created: { text: "만듦", cls: "text-dim border-edge" },
  published: { text: "올림", cls: "text-amber border-amber" },
  unpublished: { text: "내림", cls: "text-games border-games" },
  archived: { text: "보관", cls: "text-games border-games" },
  drafted: { text: "초안으로", cls: "text-dim border-edge" },
  pinned: { text: "고정", cls: "text-amber border-amber" },
  unpinned: { text: "고정 해제", cls: "text-dim border-edge" },
  deleted: { text: "삭제", cls: "text-games border-games" },
};

export function NoticeHistory({
  events,
  title = "기록",
  /** 공지 하나만 볼 때는 줄마다 slug 를 반복할 이유가 없다 */
  showSlug = true,
}: {
  events: NoticeEvent[] | null;
  title?: string;
  showSlug?: boolean;
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-baseline gap-4">
        <h3 className="text-[17px] font-semibold">{title}</h3>
        <span className="-translate-y-[3px] flex-1 border-t border-line" />
        {events && events.length > 0 && (
          <span className="u-label">{events.length}건</span>
        )}
      </div>

      {events === null ? (
        <p className="border border-amber px-4 py-3 text-[13.5px] text-amber">
          이력 테이블이 아직 없습니다. 마이그레이션
          (<span className="font-mono">20260918000001_notice_events</span>)을 올리면
          그때부터 올리고 내린 것이 쌓입니다.
        </p>
      ) : events.length === 0 ? (
        <p className="border-y border-line py-12 text-center text-[13.5px] text-dim">
          아직 기록이 없습니다. 올리거나 내리면 여기에 남습니다.
        </p>
      ) : (
        <ul className="border-t border-line">
          {events.map((e) => {
            const label = LABEL[e.action] ?? {
              text: e.action,
              cls: "text-dim border-edge",
            };
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-[11px]"
              >
                <span
                  className={`shrink-0 border px-2 py-[2px] font-mono text-[11px] tracking-tag ${label.cls}`}
                >
                  {label.text}
                </span>

                {showSlug &&
                  (e.noticeId ? (
                    <Link
                      href={`/admin/notices/${e.noticeId}`}
                      className="font-mono text-[12.5px] text-mute hover:text-amber"
                    >
                      {e.slug}
                    </Link>
                  ) : (
                    // 지워진 공지. 갈 곳이 없으니 이름만 남긴다
                    <span className="font-mono text-[12.5px] text-dim line-through">
                      {e.slug}
                    </span>
                  ))}

                <span className="ml-auto flex items-baseline gap-4 font-mono text-[12px] text-dim">
                  {e.actor && <span>{e.actor}</span>}
                  <time dateTime={e.at}>{stamp(e.at)}</time>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
