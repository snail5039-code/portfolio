import { setRequestLocale } from "next-intl/server";
import { DownloadsPage } from "@/components/pages/DownloadsPage";
import { PRODUCTS } from "@/lib/fixtures";

export default async function PreviewDownloads({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return <DownloadsPage products={PRODUCTS} />;
}
