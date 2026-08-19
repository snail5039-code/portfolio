import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";

/**
 * 디자인 확인용 화면 묶음.
 *
 * DB가 비어 있어도 모든 화면을 볼 수 있게, 예시 데이터(lib/fixtures.ts)로 렌더한다.
 * 배포본에는 나가지 않는다.
 */

const SCREENS = [
  ["", "홈"],
  ["/products", "제품 목록"],
  ["/product", "제품 상세"],
  ["/product-demo", "제품 상세 · 체험"],
  ["/downloads", "다운로드"],
  ["/notices", "공지 목록"],
  ["/notice", "공지 상세"],
  ["/changelog", "개발 기록"],
  ["/about", "소개"],
  ["/login", "로그인"],
] as const;

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <>
      <div className="border-b border-edge bg-panel">
        <div className="mx-auto flex max-w-page flex-wrap items-center gap-x-5 gap-y-2 px-gutter py-[10px]">
          <span className="u-label text-amber">디자인 확인용</span>
          {SCREENS.map(([path, label]) => (
            <Link
              key={path}
              href={`/preview${path}`}
              className="font-mono text-[12px] text-dim transition-colors hover:text-ink"
            >
              {label}
            </Link>
          ))}
          <span className="ml-auto font-mono text-[11px] text-dim">
            예시 데이터 · DB에 없음
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
