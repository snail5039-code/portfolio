interface DataBoundaryNoticeProps {
  compact?: boolean;
}

export function DataBoundaryNotice({ compact = false }: DataBoundaryNoticeProps) {
  return (
    <div className={compact ? "data-boundary compact" : "data-boundary"}>
      <strong>모의투자 · 가상 예시</strong>
      <span>실제 금융 데이터·계좌·주문·체결·외부 API와 연결되지 않습니다.</span>
    </div>
  );
}
