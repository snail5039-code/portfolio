import { NoticeForm } from "@/components/admin/NoticeForm";
import { emptyNoticeDraft } from "@/lib/queries/admin-content";

export default async function NewNotice({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <NoticeForm initial={emptyNoticeDraft()} locale={locale} />;
}
