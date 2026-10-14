import { getTranslations } from "next-intl/server";
import { Label } from "@/components/ui";
import { monthDay } from "@/lib/format";
import type { Stats as StatsData } from "@/lib/queries/products";

/**
 * 홈 상단 통계 4칸.
 * 진짜 값만 쓴다 — 0이면 0을 보여준다. (docs/DESIGN.md "글쓰기 규칙")
 */
export async function Stats({ data }: { data: StatsData }) {
  const t = await getTranslations();

  const cells = [
    { label: t("stats.products"), value: String(data.productCount) },
    {
      label: t("stats.downloads"),
      value: data.monthlyDownloads.toLocaleString(),
    },
    { label: t("stats.updated"), value: monthDay(data.lastUpdated) },
    // 총합이 아니라 오늘 값이다. 몇 달치가 쌓인 수는 어제와 오늘이 같아 보여서
    // 보고 나서 알게 되는 것이 없었다. 하루치는 변하는 게 눈에 보인다.
    { label: t("stats.today"), value: data.todayVisitors.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 border-y border-line sm:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={`py-5 sm:border-l sm:border-line sm:pl-6 ${
            i === 0 ? "sm:border-l-0 sm:pl-0" : ""
          } ${i >= 2 ? "border-t border-line sm:border-t-0" : ""}`}
        >
          <Label>{c.label}</Label>
          <b className="mt-[6px] block font-mono text-[23px] font-medium tracking-[-0.01em] text-ink">
            {c.value}
          </b>
        </div>
      ))}
    </div>
  );
}
