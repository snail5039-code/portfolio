import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { NoticeDetail } from "@/components/pages/NoticeDetail";
import { getNotice } from "@/lib/queries/notices";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

type Params = { locale: string; slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const n = await getNotice(slug, locale).catch(() => null);
  return n ? { title: n.title } : {};
}

export default async function NoticePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const notice = await getNotice(slug, locale).catch(orEmpty(null, "notice"));
  if (!notice) notFound();

  return <NoticeDetail notice={notice} />;
}
