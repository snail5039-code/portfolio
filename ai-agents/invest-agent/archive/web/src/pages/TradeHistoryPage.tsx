import { useState } from "react";
import { getTradeHistory } from "../api/tradeHistory";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { PageKey, TradeHistoryData, TradeHistoryItem, TradeStatus } from "../types/dashboard";
import "./TradeHistoryPage.css";

type TradePeriod = 7 | 30 | 90;
type StatusFilter = "all" | TradeStatus;

interface TradeHistoryPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function TradeHistoryPage({ activePage, onNavigate }: TradeHistoryPageProps) {
  const state = useFixture<TradeHistoryData>(() => getTradeHistory(), "trade-history");
  const [period, setPeriod] = useState<TradePeriod>(30);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "거래 내역");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const tradeHistoryItems = envelope.data.items;

  const visibleTrades = tradeHistoryItems.filter((trade) => trade.days <= period && (status === "all" || trade.status === status));
  const selectedTrade = visibleTrades.find((trade) => trade.id === selectedId) ?? visibleTrades[0] ?? null;

  function updatePeriod(nextPeriod: TradePeriod) {
    const nextVisible = tradeHistoryItems.filter((trade) => trade.days <= nextPeriod && (status === "all" || trade.status === status));
    setPeriod(nextPeriod);
    setSelectedId(nextVisible[0]?.id ?? "");
  }

  function updateStatus(nextStatus: StatusFilter) {
    const nextVisible = tradeHistoryItems.filter((trade) => trade.days <= period && (nextStatus === "all" || trade.status === nextStatus));
    setStatus(nextStatus);
    setSelectedId(nextVisible[0]?.id ?? "");
  }

  const main = (
    <section className="trade-main" aria-labelledby="trade-title">
      <header className="trade-summary">
        <div>
          <span className="eyebrow">모의 거래 기록</span>
          <h1 id="trade-title">주문·체결이 아닌 화면용 이력</h1>
          <p>제안과 정책 처리 결과를 실제 거래와 분리해 확인합니다.</p>
        </div>
        <div className="trade-summary-stats" aria-label="현재 필터 요약">
          <div><span>표시 이력</span><strong>{visibleTrades.length}건</strong></div>
          <div><span>외부 요청</span><strong>0건</strong></div>
          <div><span>실제 주문</span><strong>아님</strong></div>
        </div>
      </header>

      <section className="trade-filters" aria-label="거래 내역 필터">
        <div>
          <span>기간</span>
          <div className="segments">
            {[
              [7, "1주"],
              [30, "1개월"],
              [90, "3개월"]
            ].map(([value, label]) => (
              <button className={period === value ? "selected" : ""} key={value} type="button" aria-pressed={period === value} onClick={() => updatePeriod(value as TradePeriod)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>상태</span>
          <div className="segments trade-status-filters">
            {(["all", "모의승인", "반려", "정책 차단", "만료", "대기"] as StatusFilter[]).map((value) => (
              <button className={status === value ? "selected" : ""} key={value} type="button" aria-pressed={status === value} onClick={() => updateStatus(value)}>
                {value === "all" ? "전체" : value}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="history-section" aria-labelledby="history-title">
        <div className="history-head"><h2 id="history-title">가상 제안 이력</h2><span>기준 시각 {formatDateAndMinutes(envelope.dataAsOf)} KST</span></div>
        <div className="history-columns" aria-hidden="true"><span>시각 / ID</span><span>종목</span><span>구분</span><span>수량</span><span>예상 금액</span><span>상태</span></div>
        {visibleTrades.length ? (
          <div className="history-list" role="listbox" aria-label="모의 거래 이력">
            {visibleTrades.map((trade) => (
              <TradeRow key={trade.id} trade={trade} selected={selectedTrade?.id === trade.id} onSelect={setSelectedId} />
            ))}
          </div>
        ) : (
          <div className="trade-empty-state">
            <strong>선택한 조건의 화면용 이력이 없습니다.</strong>
            <span>기간 또는 상태 필터를 변경해 주세요.</span>
          </div>
        )}
      </section>
      <footer className="trade-disclaimer">{envelope.data.safetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="trade-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">선택 이력</span>
          <div className="trade-inspector-title">
            <h2>{selectedTrade ? `${selectedTrade.name} · ${selectedTrade.id}` : "선택 이력 없음"}</h2>
            <span>{selectedTrade?.status ?? "빈 결과"}</span>
          </div>
          <p>{selectedTrade?.summary ?? "필터를 변경하면 화면용 이력 상세를 확인할 수 있습니다."}</p>
        </header>
        {selectedTrade ? <TradeDetail trade={selectedTrade} /> : <EmptyTradeDetail />}
        <nav className="trade-related-links" aria-label="관련 화면">
          <h3>관련 기록</h3>
          {selectedTrade ? envelope.data.relatedLinks.map((link) => (
            <button key={link.label} type="button" disabled={link.disabled} onClick={() => link.page && onNavigate(link.page)}>
              {link.label}<span>{link.disabled ? "준비 중" : "›"}</span>
            </button>
          )) : <p>표시할 상세가 없어 관련 링크를 비활성화했습니다.</p>}
        </nav>
      </div>
      <footer>{envelope.data.safetyCopy}</footer>
    </aside>
  );

  return <AppShell title="거래 내역" accountLabel="시뮬레이션 계좌" lastSync={formatTimeOfDay(envelope.dataAsOf)} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}

function TradeRow({ trade, selected, onSelect }: { trade: TradeHistoryItem; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button className={selected ? "history-row selected" : "history-row"} type="button" role="option" aria-selected={selected} data-status={trade.status} onClick={() => onSelect(trade.id)}>
      <span><strong>{trade.occurredAt}</strong><small>{trade.id}</small></span>
      <span><strong>{trade.name}</strong><small>{trade.ticker} · 가상</small></span>
      <span>{trade.side}</span>
      <span>{trade.qty}</span>
      <span>{trade.amount}</span>
      <span className="row-status">{trade.status}</span>
    </button>
  );
}

function TradeDetail({ trade }: { trade: TradeHistoryItem }) {
  return (
    <>
      <section><h3>가상 주문 조건</h3><dl><div><dt>구분</dt><dd>{trade.side}</dd></div><div><dt>수량</dt><dd>{trade.qty}</dd></div><div><dt>지정가/예상가</dt><dd>{trade.price}</dd></div><div><dt>예상 금액</dt><dd>{trade.amount}</dd></div></dl></section>
      <section><h3>비용과 데이터 한계</h3><dl><div><dt>수수료 예시</dt><dd>{trade.fee}</dd></div><div><dt>세금 예시</dt><dd>{trade.tax}</dd></div><div><dt>슬리피지</dt><dd>{trade.slippage}</dd></div><div><dt>기준 통화</dt><dd>KRW</dd></div></dl><p className="trade-warning-note">수수료·세금·슬리피지는 실제 정산값이 아닌 가정입니다.</p></section>
      <section><h3>안전 경계</h3><dl><div><dt>정책 결과</dt><dd>{trade.policyResult}</dd></div><div><dt>출처 상태</dt><dd>{trade.sourceState}</dd></div><div><dt>외부 요청</dt><dd>0건</dd></div><div><dt>실제 계좌·주문</dt><dd>없음</dd></div></dl></section>
    </>
  );
}

function EmptyTradeDetail() {
  return (
    <>
      <section><h3>가상 주문 조건</h3><dl><div><dt>표시 이력</dt><dd>0건</dd></div><div><dt>실제 주문</dt><dd>없음</dd></div></dl></section>
      <section><h3>비용과 데이터 한계</h3><dl><div><dt>외부 요청</dt><dd>0건</dd></div><div><dt>저장</dt><dd>없음</dd></div></dl></section>
      <section><h3>안전 경계</h3><dl><div><dt>정책 결과</dt><dd>표시 대상 없음</dd></div><div><dt>출처 상태</dt><dd>외부 출처 미연결</dd></div></dl></section>
    </>
  );
}
