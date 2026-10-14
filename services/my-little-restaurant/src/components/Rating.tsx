import { Star } from "lucide-react";

/*
  타베로그처럼 "별 5개 + 굵은 숫자" 조합. 3.5점이면 별 하나가 반만 차야 하므로
  회색 별 위에 색 별을 겹쳐두고 width 퍼센트로 잘라서 소수점을 표현한다.
*/
export default function Rating({
  value,
  size = 14,
  showNumber = true,
  reviewCount,
}: {
  value: number | null | undefined;
  size?: number;
  showNumber?: boolean;
  reviewCount?: number;
}) {
  const hasValue = typeof value === "number";
  const pct = hasValue ? Math.max(0, Math.min(100, (value / 5) * 100)) : 0;

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex" aria-hidden="true">
        <span className="inline-flex">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              style={{ width: size, height: size }}
              className="fill-line text-line"
            />
          ))}
        </span>
        <span
          className="absolute inset-y-0 left-0 inline-flex overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              style={{ width: size, height: size, minWidth: size }}
              className="fill-star text-star"
            />
          ))}
        </span>
      </span>

      {showNumber && (
        <span className="tnum text-sm font-bold text-foreground">
          {hasValue ? value.toFixed(2) : "–"}
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="tnum text-xs text-muted">({reviewCount})</span>
      )}
      <span className="sr-only">
        {hasValue ? `5점 만점에 ${value.toFixed(2)}점` : "평점 없음"}
      </span>
    </span>
  );
}
