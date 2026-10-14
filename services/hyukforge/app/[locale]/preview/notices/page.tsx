import { setRequestLocale } from "next-intl/server";
import { NoticesPage } from "@/components/pages/NoticesPage";
import { NOTICES } from "@/lib/fixtures";

export default async function PreviewNotices({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return <NoticesPage notices={NOTICES} />;
}
