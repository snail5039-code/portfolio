import { setRequestLocale } from "next-intl/server";
import { ChangelogPage } from "@/components/pages/ChangelogPage";
import { CHANGELOG } from "@/lib/fixtures";

export default async function PreviewChangelog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return <ChangelogPage entries={CHANGELOG} />;
}
