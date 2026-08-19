import { notFound } from "next/navigation";
import { NoticeForm } from "@/components/admin/NoticeForm";
import { getNoticeDraft } from "@/lib/queries/admin-content";

export default async function EditNotice({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const draft = await getNoticeDraft(id);
  if (!draft) notFound();

  return <NoticeForm initial={draft} locale={locale} />;
}
