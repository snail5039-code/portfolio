import { setRequestLocale } from "next-intl/server";
import { HomeSections } from "@/components/home/HomeSections";
import { CHANGELOG, NOTICES, PRODUCTS, STATS } from "@/lib/fixtures";

export default async function Preview({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  return (
    <HomeSections
      products={PRODUCTS.slice(0, 6)}
      stats={STATS}
      changelog={CHANGELOG.slice(0, 4)}
      notices={NOTICES.slice(0, 3)}
    />
  );
}
