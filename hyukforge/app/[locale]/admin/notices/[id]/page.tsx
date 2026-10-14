import { notFound } from "next/navigation";
import { NoticeForm } from "@/components/admin/NoticeForm";
import { NoticeHistory } from "@/components/admin/NoticeHistory";
import { getNoticeDraft, listNoticeEvents } from "@/lib/queries/admin-content";

/**
 * 공지 수정.
 *
 * 폼 아래에 이 공지의 이력을 붙인다 — 본문을 고치기 전에 "이게 지금 올라가
 * 있나, 언제 내렸나"를 같은 화면에서 봐야 한다. 상태만 바꿀 거라면
 * 여기까지 들어올 필요가 없다 (목록에 버튼이 있다).
 */
export default async function EditNotice({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  const [draft, events] = await Promise.all([
    getNoticeDraft(id),
    listNoticeEvents({ noticeId: id }),
  ]);
  if (!draft) notFound();

  return (
    <>
      <NoticeForm initial={draft} locale={locale} />
      <NoticeHistory events={events} title="이 공지의 기록" showSlug={false} />
    </>
  );
}
