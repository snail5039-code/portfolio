import { setRequestLocale } from "next-intl/server";
import { NoticeDetail } from "@/components/pages/NoticeDetail";
import { NOTICES } from "@/lib/fixtures";

export default async function PreviewNotice({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return <NoticeDetail notice={NOTICES[0]} />;
}
