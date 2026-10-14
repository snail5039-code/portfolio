import { ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTaxFeeImpact } from "../api/taxFeeImpact";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { PageKey, TaxFeeImpactData, TaxFeeOrder, TaxFeeStatus, Tone } from "../types/dashboard";
import "./TaxFeeImpactPage.css";

type TaxFeeFilter = "all" | TaxFeeStatus | "none";

declare global {
  interface Window {
    __setTaxFeeImpactFilterForTest?: (filter: TaxFeeFilter) => void;
  }

  var __setTaxFeeImpactFilterForTest: ((filter: TaxFeeFilter) => void) | undefined;
}

type TaxFeeTestWindow = Window & typeof globalThis & {
  __setTaxFeeImpactFilterForTest?: (filter: TaxFeeFilter) => void;
};

const filterOptions: Array<{ key: TaxFeeFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "영향 작음", label: "영향 작음" },
  { key: "재검토", label: "재검토" },
  { key: "보류 권장", label: "보류 권장" }
];

const won = (value: number) => `${value < 0 ? "-" : ""}${Math.abs(value).toLocaleString("ko-KR")}원`;
const signedWon = (value: number) => `${value < 0 ? "-" : "+"}${Math.abs(value).toLocaleString("ko-KR")}원`;
const totalCostOf = (order: TaxFeeOrder) => order.fee + order.tax + order.slippage + order.fx;
const netOf = (order: TaxFeeOrder) => order.gross - totalCostOf(order);
const dragOf = (order: TaxFeeOrder) => (order.gross === 0 ? 0 : Math.abs((totalCostOf(order) / order.gross) * 100));
const percent = (value: number) => `${value.toFixed(1)}%`;

function statusTone(status: TaxFeeOrder["status"]): Tone {
  if (status === "영향 작음") return "success";
  if (status === "보류 권장") return "danger";
  return "warning";
}

interface TaxFeeImpactPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function TaxFeeImpactPage({ activePage, onNavigate }: TaxFeeImpactPageProps) {
  const state = useFixture<TaxFeeImpactData>(() => getTaxFeeImpact(), "tax-fee-impact");
  const [filter, setFilter] = useState<TaxFeeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hooks must run unconditionally on every render, but this handler is only
  // meaningful once the fixture has loaded. The ref lets the effect below
  // register the window hook once (empty deps) while always calling
  // whatever the latest handler is — a no-op before load, the real one after.
  const testHookRef = useRef<(filter: TaxFeeFilter) => void>(() => {});

  useEffect(() => {
    const forward = (nextFilter: TaxFeeFilter) => testHookRef.current(nextFilter);
    Object.defineProperty(window, "__setTaxFeeImpactFilterForTest", { configurable: true, writable: true, value: forward });
    Object.defineProperty(self as TaxFeeTestWindow, "__setTaxFeeImpactFilterForTest", { configurable: true, writable: true, value: forward });

    return () => {
      delete window.__setTaxFeeImpactFilterForTest;
      delete (self as TaxFeeTestWindow).__setTaxFeeImpactFilterForTest;
    };
  }, []);

  const fallback = renderFixtureFallback(state, "세금·수수료");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const taxFeeImpact = envelope.data;

  function visibleOrders(nextFilter: TaxFeeFilter) {
    if (nextFilter === "none") return [];
    return taxFeeImpact.orders.filter((order) => nextFilter === "all" || order.status === nextFilter);
  }

  const filteredOrders = visibleOrders(filter);
  const selected = filteredOrders.find((order) => order.id === selectedId) ?? filteredOrders[0] ?? null;
  const totalCost = filteredOrders.reduce((sum, order) => sum + totalCostOf(order), 0);
  const netTotal = filteredOrders.reduce((sum, order) => sum + netOf(order), 0);
  const lastSync = formatTimeOfDay(envelope.dataAsOf);

  testHookRef.current = (nextFilter: TaxFeeFilter) => {
    const nextVisible = visibleOrders(nextFilter);
    setFilter(nextFilter);
    setSelectedId(nextVisible[0]?.id ?? "");
  };

  function updateFilter(nextFilter: TaxFeeFilter) {
    const nextVisible = visibleOrders(nextFilter);
    setFilter(nextFilter);
    if (!nextVisible.some((order) => order.id === selectedId)) {
      setSelectedId(nextVisible[0]?.id ?? "");
    }
  }

  const costParts = selected
    ? [
        { label: "위탁 수수료", value: selected.fee, note: "주문 금액 대비 화면 가정" },
        { label: "세금 가정", value: selected.tax, note: selected.tax ? "매도 거래세 등 고정 예시" : "해당 없음으로 표시" },
        { label: "슬리피지", value: selected.slippage, note: "지정가와 체결 차이 가능성 예시" },
        { label: "환전 비용", value: selected.fx, note: selected.fx ? "환율 조회 없는 해외 주문 가정" : "국내 주문 해당 없음" }
      ]
    : [];
  const maxCost = Math.max(...costParts.map((part) => part.value), 1);

  const main = (
    <section className="tax-main" aria-labelledby="tax-title">
      <header className="tax-summary">
        <button className="test-hook-marker" data-test-hook="window.__setTaxFeeImpactFilterForTest('none')" type="button" onClick={() => testHookRef.current("none")}>
          window.__setTaxFeeImpactFilterForTest('none')
        </button>
        <div>
          <span className="eyebrow">승인 전 비용 영향</span>
          <h1 id="tax-title">{filteredOrders.length ? `${filteredOrders.length}개 가상 주문의 비용 차감 전후 비교` : "선택한 상태의 가상 주문 없음"}</h1>
          <p>{filteredOrders.length ? "수수료·세금·슬리피지·환전 비용 가정이 순손익 예시에 주는 영향을 확인합니다." : "다른 점검 상태를 선택하면 비용 분해가 다시 표시됩니다."}</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="tax-kpis" aria-label="현재 비용 요약">
        <div><span>표시 주문</span><strong>{filteredOrders.length}건</strong></div>
        <div><span>예상 총비용</span><strong>{won(totalCost)}</strong></div>
        <div><span>비용 후 순손익</span><strong className={netTotal < 0 ? "negative" : "positive"}>{signedWon(netTotal)}</strong></div>
        <div><span>외부 요청</span><strong>{envelope.externalConnections}건</strong></div>
      </section>

      <section className="tax-toolbar" aria-label="비용 영향 필터">
        <div className="segments tax-filters" role="group" aria-label="점검 상태">
          {filterOptions.map((option) => (
            <button className={filter === option.key ? "selected" : ""} key={option.key} type="button" aria-pressed={filter === option.key} onClick={() => updateFilter(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
        <span>원화 기준 화면용 가정 · 실제 세금 계산·세무 자문·주문 가능 판정 아님</span>
      </section>

      <section className="tax-list-section" aria-labelledby="tax-list-title">
        <div className="tax-section-head"><h2 id="tax-list-title">가상 주문별 비용 영향</h2><span>기준 시각 {formatDateAndMinutes(envelope.dataAsOf)} KST · 반올림 원 단위</span></div>
        <div className="tax-columns" aria-hidden="true"><span>주문</span><span>비용 전</span><span>수수료</span><span>세금</span><span>슬리피지</span><span>환전</span><span>총비용</span><span>순손익</span><span>상태</span></div>
        {filteredOrders.length ? (
          <div className="tax-list" role="listbox" aria-label="비용 영향 점검 주문 목록">
            {filteredOrders.map((order) => {
              const isSelected = selected?.id === order.id;
              return (
                <button className={isSelected ? "tax-row selected" : "tax-row"} key={order.id} type="button" role="option" aria-selected={isSelected} tabIndex={isSelected ? 0 : -1} onClick={() => setSelectedId(order.id)}>
                  <span><strong>{order.id} · {order.name}</strong><small>{order.side} · {order.ticker} · {order.market}</small></span>
                  <span className={order.gross < 0 ? "negative" : "positive"}>{signedWon(order.gross)}</span>
                  <span>{won(order.fee)}</span>
                  <span>{order.tax ? won(order.tax) : "없음"}</span>
                  <span>{won(order.slippage)}</span>
                  <span>{order.fx ? won(order.fx) : "없음"}</span>
                  <span>{won(totalCostOf(order))}</span>
                  <span className={netOf(order) < 0 ? "negative" : "positive"}>{signedWon(netOf(order))}</span>
                  <span><StatusPill tone={statusTone(order.status)}>{order.status}</StatusPill></span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="tax-empty-state"><strong>선택한 상태의 가상 주문이 없습니다.</strong><span>필터를 변경하면 첫 번째 보이는 주문이 자동 선택됩니다.</span></div>
        )}
      </section>

      <section className="tax-breakdown-section" aria-labelledby="tax-breakdown-title">
        <div className="tax-section-head"><h2 id="tax-breakdown-title">선택 주문 비용 분해</h2><span>{selected ? `${selected.id} · ${selected.currency} · ${selected.period}` : "빈 결과"}</span></div>
        <div className="tax-detail-grid">
          <article><span>비용 전 총손익</span><strong className={(selected?.gross ?? 0) < 0 ? "negative" : "positive"}>{selected ? signedWon(selected.gross) : "미표시"}</strong><small>비용 차감 전 화면용 총손익</small></article>
          <article><span>총비용</span><strong>{selected ? won(totalCostOf(selected)) : "미표시"}</strong><small>수수료·세금·슬리피지·환전 합계</small></article>
          <article><span>비용 후 순손익</span><strong className={selected && netOf(selected) < 0 ? "negative" : "positive"}>{selected ? signedWon(netOf(selected)) : "미표시"}</strong><small>비용 차감 후 순손익 예시</small></article>
          <article><span>비용 영향률</span><strong>{selected ? percent(dragOf(selected)) : "미표시"}</strong><small>비용 전 손익 대비 비용 비율</small></article>
        </div>
        <div className="tax-bars" aria-label="비용 구성 막대">
          {selected ? costParts.map((part) => (
            <div className="tax-bar-card" key={part.label}>
              <div><strong>{part.label}</strong><span>{won(part.value)}</span></div>
              <i><b style={{ width: `${Math.max(4, Math.round((part.value / maxCost) * 100))}%` }} /></i>
              <small>{part.note}</small>
            </div>
          )) : <p>표시할 비용 분해가 없습니다.</p>}
        </div>
      </section>

      <footer className="tax-disclaimer">{taxFeeImpact.safetyCopy} · 실제 세금 계산·세무 자문·주문 가능 판정 아님</footer>
    </section>
  );

  const inspector = (
    <aside className="tax-inspector" aria-live="polite">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 주문</span>
          <div className="decision-title">
            <div><h2>{selected ? `${selected.name} ${selected.side}` : "선택 주문 없음"}</h2><span>{selected ? `${selected.id} · ${selected.ticker}` : "필터 결과 없음"}</span></div>
            <StatusPill tone={selected ? statusTone(selected.status) : "warning"}>{selected?.status ?? "빈 결과"}</StatusPill>
          </div>
          <p>{selected?.summary ?? "현재 필터에 해당하는 가상 주문이 없습니다."}</p>
        </header>

        <section className="inspector-section proposal">
          <h3>주문 조건</h3>
          <dl>
            <div><dt>종목</dt><dd>{selected ? `${selected.name} (${selected.ticker})` : "미표시"}</dd></div>
            <div><dt>구분</dt><dd>{selected ? `${selected.side} · ${selected.market}` : "미표시"}</dd></div>
            <div><dt>조건</dt><dd>{selected?.basis ?? "미표시"}</dd></div>
            <div><dt>기간</dt><dd>{selected?.period ?? "미표시"}</dd></div>
          </dl>
        </section>

        <section className="inspector-section verification">
          <h3>비용 가정</h3>
          <dl>
            <div><dt>수수료</dt><dd>{selected ? won(selected.fee) : "미표시"}</dd></div>
            <div><dt>세금 가정</dt><dd>{selected ? won(selected.tax) : "미표시"}</dd></div>
            <div><dt>슬리피지</dt><dd>{selected ? won(selected.slippage) : "미표시"}</dd></div>
            <div><dt>환전 비용</dt><dd>{selected ? (selected.fx ? won(selected.fx) : "해당 없음") : "미표시"}</dd></div>
          </dl>
          <div className="warning"><b>세금 경계</b><p>세율·수수료·슬리피지는 UI 검토를 위한 고정값이며 실제 적용값이 아닙니다.</p></div>
        </section>

        <section className="inspector-section verification">
          <h3>승인 전 영향</h3>
          <dl>
            <div><dt>비용 전 총손익</dt><dd>{selected ? signedWon(selected.gross) : "미표시"}</dd></div>
            <div><dt>총비용</dt><dd>{selected ? won(totalCostOf(selected)) : "미표시"}</dd></div>
            <div><dt>비용 후 순손익</dt><dd>{selected ? signedWon(netOf(selected)) : "미표시"}</dd></div>
            <div><dt>비용 영향률</dt><dd>{selected ? percent(dragOf(selected)) : "미표시"}</dd></div>
          </dl>
        </section>

        <section className="inspector-section boundary-box">
          <h3>데이터·실행 경계</h3>
          <p>{taxFeeImpact.safetyCopy}</p>
        </section>
      </div>

      <div className="approval-panel tax-actions">
        <div className="expiry">
          <span>{selected ? selected.next : "현재 연결할 주문 기록이 없습니다."}</span>
          <small>투자 권유가 아니라 승인 전 비용 점검 표시입니다.</small>
        </div>
        <button type="button" disabled={!selected} onClick={() => selected && onNavigate(selected.linkPage)}>
          관련 화면 보기 <ArrowRight size={14} />
        </button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 실제 주문·체결 아님 · 외부 요청 {envelope.externalConnections}건</p>
      </div>
    </aside>
  );

  return <AppShell title="세금·수수료" accountLabel="시뮬레이션 계좌" lastSync={lastSync} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}
