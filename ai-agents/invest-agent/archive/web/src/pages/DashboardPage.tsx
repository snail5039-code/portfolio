import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleDot, XCircle } from "lucide-react";
import { approveOrder, rejectOrder } from "../api/approvals";
import { ApiError } from "../api/client";
import { getDashboard } from "../api/dashboard";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { MockChart } from "../components/MockChart";
import { StatusPill } from "../components/StatusPill";
import {
  formatDateAndMinutes,
  formatPercent,
  formatShares,
  formatSignedPercent,
  formatSignedWon,
  formatTimeOfDay,
  formatWon
} from "../lib/format";
import type { DashboardData, DecisionStatus, EvidenceItem, Holding, PageKey, Tone } from "../types/dashboard";
import "./DashboardPage.css";

function toneIcon(tone: Tone) {
  if (tone === "success") return <CheckCircle2 size={14} />;
  if (tone === "warning") return <AlertTriangle size={14} />;
  if (tone === "danger") return <XCircle size={14} />;
  return <CircleDot size={14} />;
}

/** Fields that do not apply to a holding (cash has no average price) arrive as null. */
function optionalWon(amount: number | null) {
  return amount === null ? "-" : formatWon(amount);
}

function profitToneClass(profit: number | null) {
  if (profit === null) return "";
  return profit < 0 ? "loss" : "gain";
}

function EvidenceRow({ item, open }: { item: EvidenceItem; open?: boolean }) {
  const [expanded, setExpanded] = useState(Boolean(open));

  return (
    <div className="evidence-block">
      <button
        className="evidence-row"
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span>{item.title}</span>
        {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
      </button>
      {expanded ? (
        <div className={`evidence-detail ${item.tone}`}>
          <p>{item.detail}</p>
          <small>{item.source}</small>
        </div>
      ) : null}
    </div>
  );
}

function HoldingRow({ holding }: { holding: Holding }) {
  return (
    <tr className={holding.selected ? "selected-row" : ""}>
      <td>
        <strong>{holding.name}</strong>
        <small>{holding.code}</small>
      </td>
      <td>{holding.quantity === null ? "-" : formatShares(holding.quantity)}</td>
      <td>{optionalWon(holding.averagePrice)}</td>
      <td>{optionalWon(holding.currentPrice)}</td>
      <td>{formatWon(holding.value)}</td>
      <td className={profitToneClass(holding.profit)}>
        {holding.profit === null ? "-" : formatSignedWon(holding.profit)}
        {holding.profitRate === null ? null : <small>{formatSignedPercent(holding.profitRate)}</small>}
      </td>
      <td>{formatPercent(holding.weight)}</td>
      <td><StatusPill tone={holding.tone}>{holding.status}</StatusPill></td>
    </tr>
  );
}

interface DashboardPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function DashboardPage({ activePage, onNavigate }: DashboardPageProps) {
  const state = useFixture<DashboardData>(() => getDashboard(), "dashboard");
  const [pendingAction, setPendingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Live decision state layered over the fetched envelope, same pattern as
  // ApprovalQueuePage: the approve/reject response is reflected immediately
  // without a full refetch (which would flash the loading screen). Reset when
  // a fresh envelope arrives.
  const [decisionOverride, setDecisionOverride] = useState<{
    decisionStatus: DecisionStatus;
    decidedAt: string | null;
  } | null>(null);

  useEffect(() => {
    setDecisionOverride(null);
  }, [state.envelope]);

  const fallback = renderFixtureFallback(state, "대시보드");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const lastSync = formatTimeOfDay(envelope.dataAsOf);
  const dashboard = envelope.data;
  const { summary } = dashboard;
  const decision = { ...dashboard.decision, ...decisionOverride };
  const decisionIsPending = decision.decisionStatus === "pending";

  async function decide(action: "approve" | "reject") {
    setActionError(null);
    setPendingAction(true);
    try {
      const result = action === "approve" ? await approveOrder(decision.decisionId) : await rejectOrder(decision.decisionId);
      setDecisionOverride({ decisionStatus: result.data.decisionStatus, decidedAt: result.data.decidedAt });
    } catch (cause) {
      setActionError(cause instanceof ApiError ? cause.message : "요청을 처리하지 못했습니다.");
    } finally {
      setPendingAction(false);
    }
  }

  const main = (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <section className="summary">
        <div>
          <div className="eyebrow">총자산</div>
          <div className="balance-row">
            <h1 id="dashboard-title">{formatWon(summary.totalAsset)}</h1>
            <span className="gain">
              {formatSignedWon(summary.todayProfit)} <b>({formatSignedPercent(summary.todayProfitRate)})</b> 오늘
            </span>
          </div>
          <p className="metrics">
            <span>투자원금 <b>{formatWon(summary.principal)}</b></span>
            <i />
            <span>누적손익 <b className="gain">{formatSignedWon(summary.accumulatedProfit)}</b></span>
            <i />
            <span>현금 <b>{formatPercent(summary.cashWeight, 1)}</b></span>
          </p>
          <p className="timestamps">
            기준 시각 {formatDateAndMinutes(envelope.dataAsOf)} <span>·</span> 마지막 검증{" "}
            {formatTimeOfDay(summary.lastVerifiedAt)}
          </p>
        </div>
        <DataBoundaryNotice />
      </section>

      <section className="chart-section" aria-labelledby="chart-title">
        <div className="section-toolbar">
          <div className="segments" aria-label="기간 선택">
            {["1일", "1주", "1개월", "3개월", "올해", "1년"].map((label) => (
              <button className={label === "3개월" ? "selected" : ""} key={label} type="button">
                {label}
              </button>
            ))}
          </div>
          <div className="segments" aria-label="차트 보기">
            {["자산", "벤치마크", "낙폭"].map((label) => (
              <button className={label === "자산" ? "selected" : ""} key={label} type="button">
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-head">
          <h2 id="chart-title">자산 변화</h2>
          <div className="legend">
            <span><i className="blue" />내 포트폴리오</span>
            <span><i className="gray" />벤치마크</span>
            <span><i className="event" />검증 이벤트</span>
          </div>
        </div>
        <MockChart points={dashboard.chart} />
      </section>

      <section className="holdings" aria-labelledby="holdings-title">
        <div className="holdings-head">
          <h2 id="holdings-title">보유 종목 <span>{dashboard.holdings.length}</span></h2>
          <span>평가금액 합계 <b>{formatWon(summary.totalAsset)}</b></span>
        </div>
        <table>
          <thead>
            <tr>
              <th>종목</th>
              <th>수량</th>
              <th>평균단가</th>
              <th>현재가</th>
              <th>평가금액</th>
              <th>손익</th>
              <th>비중</th>
              <th>AI 상태</th>
            </tr>
          </thead>
          <tbody>
            {dashboard.holdings.map((holding) => (
              <HoldingRow holding={holding} key={holding.code} />
            ))}
          </tbody>
        </table>
      </section>
    </section>
  );

  const inspector = (
    <aside className="inspector" aria-label="선택 결정 상세">
      <div className="inspector-scroll">
        <div className="inspector-header">
          <span className="eyebrow">현재 판단</span>
          <div className="decision-title">
            <div>
              <h2>{decision.company}</h2>
              <span>{decision.decisionId}</span>
            </div>
            <StatusPill tone={decisionIsPending ? decision.statusTone : "info"}>
              {decision.decisionStatus === "approved"
                ? "모의승인됨"
                : decision.decisionStatus === "rejected"
                  ? "반려됨"
                  : decision.status}
            </StatusPill>
          </div>
        </div>

        <div className="workflow" aria-label="에이전트 처리 단계">
          {["분석", "검증", "승인 대기"].map((step, index) => {
            const stepDone = index < 2 || !decisionIsPending;
            const stepLabel =
              index === 0
                ? "완료"
                : index === 1
                  ? formatTimeOfDay(summary.lastVerifiedAt)
                  : decisionIsPending
                    ? "대기"
                    : decision.decidedAt
                      ? formatTimeOfDay(decision.decidedAt)
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
          <h3>제안</h3>
          <strong>{decision.proposal}</strong>
          <dl>
            <div><dt>지정가</dt><dd>{formatWon(decision.limitPrice)}</dd></div>
            <div>
              <dt>목표 비중</dt>
              <dd>{formatPercent(decision.targetWeightFrom)} → {formatPercent(decision.targetWeightTo)}</dd>
            </div>
            <div><dt>최대 주문금액</dt><dd>{formatWon(decision.limitAmount)}</dd></div>
          </dl>
        </section>

        <section className="inspector-section evidence">
          <h3>핵심 근거</h3>
          {decision.evidence.map((item, index) => (
            <EvidenceRow item={item} key={item.title} open={index === 0} />
          ))}
        </section>

        <section className="inspector-section verification">
          <h3>시뮬레이션 검증 결과</h3>
          <dl>
            {decision.checks.map((check) => (
              <div key={check.label}>
                <dt>{check.label}</dt>
                <dd className={check.tone}>{toneIcon(check.tone)}{check.value}</dd>
              </div>
            ))}
          </dl>
          <div className="warning">
            <b>변동성 주의</b>
            <p>최근 20일 변동성이 사용자 기준에 근접했습니다. 이 내용은 fixture 기반 예시입니다.</p>
          </div>
        </section>

        <details className="invalid-conditions">
          <summary>판단 무효 조건 <span>{decision.invalidConditions.length}개</span></summary>
          <ul>
            {decision.invalidConditions.map((condition) => (
              <li key={condition}>{condition}</li>
            ))}
          </ul>
        </details>
      </div>

      <div className="approval-panel">
        <div className="expiry">
          <span>이 모의승인은 <b>{formatTimeOfDay(decision.expiresAt)}</b>에 만료됩니다.</span>
          <small>실제(비가상) 자금은 이동하지 않습니다. KIS 모의투자가 연결된 경우 승인 시 그 가상계좌로 지정가 주문이 전송됩니다.</small>
        </div>
        {!decisionIsPending ? (
          <div className="decision-message" aria-live="polite">
            {decision.decisionStatus === "approved"
              ? decision.kisOrderNo
                ? `모의승인됨 · ${decision.decidedAt ? formatDateAndMinutes(decision.decidedAt) : ""} · KIS 모의투자 주문번호 ${decision.kisOrderNo} (실제 자금 이동 없음).`
                : `모의승인됨 · ${decision.decidedAt ? formatDateAndMinutes(decision.decidedAt) : ""} · 실제 주문은 생성되지 않았습니다.`
              : `반려됨 · ${decision.decidedAt ? formatDateAndMinutes(decision.decidedAt) : ""} · 로컬 화면 상태만 변경되었습니다.`}
          </div>
        ) : null}
        {actionError ? <div className="decision-message" role="alert">{actionError}</div> : null}
        <div className="actions">
          <button type="button" disabled={!decisionIsPending || pendingAction} onClick={() => decide("reject")}>
            반려
          </button>
          <button type="button" disabled={!decisionIsPending || pendingAction} onClick={() => decide("approve")}>
            {formatWon(decision.limitAmount)} 한도 내 모의승인
          </button>
        </div>
        <button className="evidence-link" type="button" onClick={() => onNavigate("approvals")}>
          승인 대기 목록에서 함께 보기
        </button>
        <p>모의투자 · 화면 검토용 예시 데이터</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title={dashboard.title}
      accountLabel={dashboard.accountLabel}
      lastSync={lastSync}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
