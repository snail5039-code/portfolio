import { ShieldCheck } from "lucide-react";
import type { ModelRestaurantMatch } from "@/lib/modelRestaurant";

export default function ModelRestaurantBadge({
  info,
}: {
  info: ModelRestaurantMatch;
}) {
  const designatedDigits = info.designatedAt?.replace(/\D/g, "") ?? "";
  const designatedLabel =
    designatedDigits.length >= 6
      ? `${designatedDigits.slice(0, 4)}.${designatedDigits.slice(4, 6)} 지정`
      : null;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-brand/40 bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand"
      title={`행정안전부 모범음식점 지정 업소${designatedLabel ? ` (${designatedLabel})` : ""}${
        info.foodType ? ` · ${info.foodType}` : ""
      }`}
    >
      <ShieldCheck className="h-3 w-3" strokeWidth={2.2} />
      모범음식점{info.foodType ? ` · ${info.foodType}` : ""}
    </span>
  );
}
