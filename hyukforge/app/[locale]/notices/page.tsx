import { setRequestLocale } from "next-intl/server";
import { NoticesPage } from "@/components/pages/NoticesPage";
import { listNotices } from "@/lib/queries/notices";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

export default async function Notices({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const notices = await listNotices(locale).catch(orEmpty([], "notices"));
  return <NoticesPage notices={notices} />;
}
