import type { ChartPoint } from "../types/dashboard";

interface MockChartProps {
  points: ChartPoint[];
}

function normalize(value: number) {
  const min = -4;
  const max = 8;
  return 150 - ((value - min) / (max - min)) * 132;
}

function toPolyline(points: ChartPoint[], key: "portfolio" | "benchmark") {
  const step = 698 / Math.max(points.length - 1, 1);
  return points.map((point, index) => `${46 + index * step},${normalize(point[key]).toFixed(1)}`).join(" ");
}

export function MockChart({ points }: MockChartProps) {
  const eventIndex = points.findIndex((point) => point.event);
  const eventPoint = eventIndex >= 0 ? points[eventIndex] : points[0];
  const eventX = 46 + eventIndex * (698 / Math.max(points.length - 1, 1));
  const eventY = normalize(eventPoint.portfolio);

  return (
    <div className="chart-wrap">
      <svg viewBox="0 0 760 176" role="img" aria-label="3개월 포트폴리오와 벤치마크 수익률 차트">
        <g className="grid">
          <line x1="46" y1="18" x2="744" y2="18" />
          <line x1="46" y1="62" x2="744" y2="62" />
          <line x1="46" y1="106" x2="744" y2="106" />
          <line x1="46" y1="150" x2="744" y2="150" />
        </g>
        <g className="axis">
          <text x="4" y="22">+8%</text>
          <text x="4" y="66">+4%</text>
          <text x="18" y="110">0%</text>
          <text x="7" y="154">-4%</text>
          <text x="46" y="173">6월</text>
          <text x="372" y="173">7월</text>
          <text x="720" y="173">8월</text>
        </g>
        <polyline className="benchmark-line" points={toPolyline(points, "benchmark")} />
        <polyline className="portfolio-line" points={toPolyline(points, "portfolio")} />
        {eventIndex >= 0 ? (
          <circle className="event-point" cx={eventX} cy={eventY} r="5">
            <title>{eventPoint.event}</title>
          </circle>
        ) : null}
      </svg>
      <div className="chart-callout">
        <strong>{eventPoint.label}</strong>
        <span>내 포트폴리오 {eventPoint.portfolio.toFixed(2)}%</span>
        <span>벤치마크 {eventPoint.benchmark.toFixed(2)}%</span>
        <p>{eventPoint.event}</p>
      </div>
    </div>
  );
}
