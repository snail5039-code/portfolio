import { useEffect, useState } from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { approveOrder, getApprovals, rejectOrder } from "../api/approvals";
import { ApiError } from "../api/client";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatShares, formatTimeOfDay, formatWon } from "../lib/format";
import type { ApprovalCategory, ApprovalOrder, ApprovalsData, PageKey } from "../types/dashboard";
import "./ApprovalQueuePage.css";

type FilterKey = "all" | ApprovalCategory;

const FILTER_OPTIONS: Array<[FilterKey, string]> = [
  ["all", "전체"],
  ["conditional", "조건부"],
  ["verified", "확인됨"],
  ["attention", "확인필요"]
];

function stateLabel(order: ApprovalOrder) {
  if (order.decisionStatus === "approved") return "모의승인됨";
  if (order.decisionStatus === "rejected") return "반려됨";
  return order.reviewLabel;
}

interface ApprovalQueuePageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function ApprovalQueuePage({ activePage, onNavigate }: ApprovalQueuePageProps) {
  const state = useFixture<ApprovalsData>(() => getApprovals(), "approvals");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  // Decisions made in this session, layered over the fetched list so a
  // approve/reject reflects immediately without re-fetching (and re-flashing
  // the loading screen) on every click. Cleared whenever a fresh envelope
  // arrives (e.g. the user hit "다시 시도" after a load failure).
  const [overrides, setOverrides] = useState<Record<string, ApprovalOrder>>({});

  useEffect(() => {
    setOverrides({});
  }, [state.envelope]);

  const fallback = renderFixtureFallback(state, "승인 대기");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const orders = envelope.data.orders.map((order) => overrides[order.id] ?? order);
  const visibleOrders = orders.filter((order) => filter === "all" || order.category === filter);
  const selected = orders.find((order) => order.id === selectedId) ?? visibleOrders[0] ?? orders[0];
  const selectedIsPending = selected.decisionStatus === "pending";
  const selectedIsBusy = pendingActionId === selected.id;

  function updateFilter(nextFilter: FilterKey) {
    const nextVisible = orders.filter((order) => nextFilter === "all" || order.category === nextFilter);
    setFilter(nextFilter);
    if (nextVisible.length > 0 && !nextVisible.some((order) => order.id === selectedId)) {
      setSelectedId(nextVisible[0].id);
    }
  }

  async function decide(orderId: string, action: "approve" | "reject") {
    setActionError(null);
    setPendingActionId(orderId);
    try {
      const result = action === "approve" ? await approveOrder(orderId) : await rejectOrder(orderId);
      setOverrides((current) => ({ ...current, [orderId]: result.data }));
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setPendingActionId(null);
    }
  }

  const main = (
    <section className="approval-main" aria-labelledby="approval-title">
      <header className="approval-header">
        <div>
          <span className="eyebrow">투자 운영</span>
          <h1 id="approval-title">승인 대기</h1>
          <p>검증 결과와 주문 한도를 비교한 뒤 로컬 백엔드의 모의 상태만 변경합니다.</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <div className="approval-toolbar">
        <div className="approval-summary">
          <strong>{visibleOrders.length}건</strong>
          <span>처리할 가상 요청</span>
        </div>
        <div className="segments approval-filters" role="group" aria-label="승인 상태 필터">
          {FILTER_OPTIONS.map(([key, label]) => (
            <button
              className={filter === key ? "selected" : ""}
              key={key}
              type="button"
              aria-pressed={filter === key}
              onClick={() => updateFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="sync">마지막 검증 {formatTimeOfDay(envelope.dataAsOf)}</span>
      </div>

      <div className="orders-table" role="grid" aria-label="화면용 가상 승인 대기 주문">
        <div className="order-head" role="row">
          <span role="columnheader">상태</span>
          <span role="columnheader">종목 / 코드</span>
          <span role="columnheader">구분</span>
          <span role="columnheader">수량</span>
          <span role="columnheader">가격</span>
          <span role="columnheader">최대금액</span>
          <span role="columnheader">검증</span>
          <span role="columnheader">만료</span>
        </div>
        {visibleOrders.length ? (
          visibleOrders.map((order) => (
            <div
              className={order.id === selected.id ? "order-row selected" : "order-row"}
              key={order.id}
              role="row"
              aria-selected={order.id === selected.id}
              onClick={() => setSelectedId(order.id)}
            >
              <span className="order-select-cell" role="gridcell">
                <button
                  className="order-select-button"
                  type="button"
                  aria-label={`${order.id} ${order.company} 주문 선택`}
                  aria-pressed={order.id === selected.id}
                  onClick={() => setSelectedId(order.id)}
                >
                  <StatusPill tone={order.decisionStatus === "pending" ? order.tone : "info"}>
                    {stateLabel(order)}
                  </StatusPill>
                </button>
              </span>
              <span role="gridcell"><strong>{order.company}</strong><small>{order.code}</small></span>
              <span className={order.side === "매수" ? "buy" : "sell"} role="gridcell">{order.side}</span>
              <span role="gridcell">{formatShares(order.quantity)}</span>
              <span role="gridcell">{formatWon(order.price)}</span>
              <span role="gridcell">{formatWon(order.amount)}</span>
              <span role="gridcell">{order.verification}</span>
              <span role="gridcell">{formatTimeOfDay(order.expiresAt)}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">선택한 상태의 요청이 없습니다.</div>
        )}
      </div>
    </section>
  );

  const inspector = (
    <aside className="approval-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header className="order-detail-header">
          <span className="eyebrow">선택 주문</span>
          <div className="decision-title">
            <div>
              <h2>{selected.company}</h2>
              <span>{selected.id} · {selected.code}</span>
            </div>
            <StatusPill tone={selectedIsPending ? selected.tone : "info"}>{stateLabel(selected)}</StatusPill>
          </div>
        </header>

        <div className="workflow" aria-label="처리 단계">
          {["분석", "검증", "승인 대기"].map((step, index) => {
            const stepDone = index < 2 || !selectedIsPending;
            const stepLabel =
              index < 2
                ? "완료"
                : selectedIsPending
                  ? formatTimeOfDay(selected.expiresAt)
                  : selected.decidedAt
                    ? formatTimeOfDay(selected.decidedAt)
                    : "완료";
            return (
              <div className="workflow-item" key={step}>
                <div className={stepDone ? "step done" : "step current"}>
                  <i>{stepDone ? <CheckCircle2 size={11} /> : null}</i>
                  <b>{step}</b>
                  <span>{stepLabel}</span>
                </div>
                {index < 2 ? <div className={index === 0 ? "line done" : "line"} /> : null}
              </div>
            );
          })}
        </div>

        <section className="inspector-section proposal">
          <h3>주문 조건</h3>
          <strong>{selected.company} {formatShares(selected.quantity)} 지정가 {selected.side}</strong>
          <dl>
            <div><dt>지정가</dt><dd>{formatWon(selected.price)}</dd></div>
            <div><dt>최대 금액</dt><dd>{formatWon(selected.amount)}</dd></div>
            <div><dt>계산식</dt><dd>{selected.quantity} × {selected.price.toLocaleString("ko-KR")} = {formatWon(selected.amount)}</dd></div>
          </dl>
        </section>

        <section className="inspector-section verification">
          <h3>시뮬레이션 검증 결과</h3>
          <dl>
            <div><dt>정책 한도</dt><dd className={selected.policyPassed ? "success" : "warning"}>{selected.policyLabel}</dd></div>
            <div><dt>근거 출처</dt><dd className="warning">{selected.sourceLabel}</dd></div>
            <div>
              <dt>KIS 모의투자 주문</dt>
              <dd className="success">{selected.kisOrderNo ? `전송됨 · 주문번호 ${selected.kisOrderNo}` : "생성 안 됨"}</dd>
            </div>
          </dl>
          <div className="warning">
            <b>{selected.warningTitle}</b>
            <p>{selected.warningDetail}</p>
          </div>
        </section>
      </div>

      <div className="approval-panel">
        <div className="expiry">
          <span>이 모의승인은 <b>{formatTimeOfDay(selected.expiresAt)}</b>에 만료됩니다.</span>
          <small>실제(비가상) 자금은 이동하지 않습니다. KIS 모의투자가 연결된 경우 승인 시 그 가상계좌로 지정가 주문이 전송됩니다.</small>
        </div>
        {!selectedIsPending ? (
          <div className="decision-message" aria-live="polite">
            {selected.decisionStatus === "approved"
              ? selected.kisOrderNo
                ? `모의승인됨 · ${selected.decidedAt ? formatDateAndMinutes(selected.decidedAt) : ""} · KIS 모의투자 주문번호 ${selected.kisOrderNo} (실제 자금 이동 없음).`
                : `모의승인됨 · ${selected.decidedAt ? formatDateAndMinutes(selected.decidedAt) : ""} · 실제 주문은 생성되지 않았습니다.`
              : `반려됨 · ${selected.decidedAt ? formatDateAndMinutes(selected.decidedAt) : ""} · 가상 요청이 종료되었습니다.`}
          </div>
        ) : null}
        {actionError ? (
          <div className="decision-message" role="alert">{actionError}</div>
        ) : null}
        <div className="actions">
          <button
            type="button"
            disabled={!selectedIsPending || selectedIsBusy}
            onClick={() => decide(selected.id, "reject")}
          >
            반려
          </button>
          <button
            type="button"
            disabled={!selectedIsPending || selectedIsBusy}
            onClick={() => decide(selected.id, "approve")}
          >
            {formatWon(selected.amount)} 한도 내 모의승인
          </button>
        </div>
        <button className="evidence-link" type="button" onClick={() => onNavigate("evidence")}>
          <FileText size={13} aria-hidden="true" />
          근거 패킷 보기
        </button>
        <p>모의투자 · 화면 검토용 가상 예시</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title="승인 대기"
      accountLabel="시뮬레이션 계좌"
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
