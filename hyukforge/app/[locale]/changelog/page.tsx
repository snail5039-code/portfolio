import { setRequestLocale } from "next-intl/server";
import { ChangelogPage } from "@/components/pages/ChangelogPage";
import { listChangelog } from "@/lib/queries/changelog";
import { orEmpty } from "@/lib/queries/safe";

export const revalidate = 300;

export default async function Changelog({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; product?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { month, product } = await searchParams;

  const entries = await listChangelog(locale, 100).catch(orEmpty([], "changelog"));
  return <ChangelogPage entries={entries} activeMonth={month} activeProduct={product} />;
}
