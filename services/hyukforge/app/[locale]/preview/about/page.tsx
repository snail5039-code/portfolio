import { setRequestLocale } from "next-intl/server";
import { AboutPage } from "@/components/pages/AboutPage";
import { getWip } from "@/lib/studio";

export default async function PreviewAbout({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AboutPage wip={getWip(locale)} />;
}
