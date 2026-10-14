import { ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getDecisionReview } from "../api/decisionReview";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { DecisionReviewData, DecisionReviewItem, DecisionReviewOutcome, PageKey, Tone } from "../types/dashboard";
import "./DecisionReviewPage.css";

type DecisionReviewFilter = "all" | DecisionReviewOutcome | "none";

declare global {
  interface Window {
    __setDecisionReviewFilterForTest?: (filter: DecisionReviewFilter, memoOnly?: boolean) => void;
  }

  var __setDecisionReviewFilterForTest: ((filter: DecisionReviewFilter, memoOnly?: boolean) => void) | undefined;
}

type DecisionReviewTestWindow = Window & typeof globalThis & {
  __setDecisionReviewFilterForTest?: (filter: DecisionReviewFilter, memoOnly?: boolean) => void;
};

const filterOptions: Array<{ key: DecisionReviewFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "승인", label: "승인" },
  { key: "반려", label: "반려" },
  { key: "보류", label: "보류" }
];

function decisionTone(decision: DecisionReviewItem["decision"]): Tone {
  if (decision === "승인") return "success";
  if (decision === "반려") return "danger";
  return "warning";
}

interface DecisionReviewPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function DecisionReviewPage({ activePage, onNavigate }: DecisionReviewPageProps) {
  const state = useFixture<DecisionReviewData>(() => getDecisionReview(), "decision-review");
  const [filter, setFilter] = useState<DecisionReviewFilter>("all");
  const [memoOnly, setMemoOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // See TaxFeeImpactPage for why this indirection exists: hooks must run
  // unconditionally, but the real handler needs data only available after load.
  const testHookRef = useRef<(filter: DecisionReviewFilter, memoOnly?: boolean) => void>(() => {});

  useEffect(() => {
    const forward = (nextFilter: DecisionReviewFilter, nextMemoOnly?: boolean) => testHookRef.current(nextFilter, nextMemoOnly);
    Object.defineProperty(window, "__setDecisionReviewFilterForTest", { configurable: true, writable: true, value: forward });
    Object.defineProperty(self as DecisionReviewTestWindow, "__setDecisionReviewFilterForTest", { configurable: true, writable: true, value: forward });

    return () => {
      delete window.__setDecisionReviewFilterForTest;
      delete (self as DecisionReviewTestWindow).__setDecisionReviewFilterForTest;
    };
  }, []);

  const fallback = renderFixtureFallback(state, "결정 회고");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const decisionReview = envelope.data;

  function visibleDecisions(nextFilter: DecisionReviewFilter, nextMemoOnly: boolean) {
    if (nextFilter === "none") return [];
    return decisionReview.decisions.filter((item) => (nextFilter === "all" || item.decision === nextFilter) && (!nextMemoOnly || item.memo));
  }

  const filteredDecisions = visibleDecisions(filter, memoOnly);
  const selected = filteredDecisions.find((item) => item.id === selectedId) ?? filteredDecisions[0] ?? null;
  const memoCount = filteredDecisions.filter((item) => item.memo).length;
  const lastSync = formatTimeOfDay(envelope.dataAsOf);

  testHookRef.current = (nextFilter: DecisionReviewFilter, nextMemoOnly = false) => {
    const nextVisible = visibleDecisions(nextFilter, nextMemoOnly);
    setFilter(nextFilter);
    setMemoOnly(nextMemoOnly);
    setSelectedId(nextVisible[0]?.id ?? "");
  };

  function updateFilter(nextFilter: DecisionReviewFilter, nextMemoOnly = memoOnly) {
    const nextVisible = visibleDecisions(nextFilter, nextMemoOnly);
    setFilter(nextFilter);
    setMemoOnly(nextMemoOnly);
    if (!nextVisible.some((item) => item.id === selectedId)) {
      setSelectedId(nextVisible[0]?.id ?? "");
    }
  }

  const main = (
    <section className="review-main" aria-labelledby="review-title">
      <header className="review-summary">
        <button className="test-hook-marker" data-test-hook="window.__setDecisionReviewFilterForTest('none')" type="button" onClick={() => testHookRef.current("none")}>
          window.__setDecisionReviewFilterForTest('none')
        </button>
        <div>
          <span className="eyebrow">사용자 최종 통제 기록</span>
          <h1 id="review-title">{filteredDecisions.length ? `${filteredDecisions.length}개 가상 결정 이력` : "선택한 조건의 결정 이력 없음"}</h1>
          <p>{filteredDecisions.length ? "승인·반려·보류 당시의 근거, 사용자 메모, 검증 상태를 중립적으로 되돌아봅니다." : "상태 필터 또는 메모 조건을 바꾸면 결정 회고가 다시 표시됩니다."}</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="review-kpis" aria-label="현재 결정 회고 요약">
        <div><span>표시 결정</span><strong>{filteredDecisions.length}건</strong></div>
        <div><span>사용자 메모</span><strong>{memoCount}건</strong></div>
        <div><span>실행 상태</span><strong>{envelope.executed ? "실행됨" : "실행 안 됨"}</strong></div>
        <div><span>외부 요청</span><strong>{envelope.externalConnections}건</strong></div>
      </section>

      <section className="review-toolbar" aria-label="결정 이력 필터">
        <div className="segments review-filters" role="group" aria-label="결정 상태">
          {filterOptions.map((option) => (
            <button className={filter === option.key ? "selected" : ""} key={option.key} type="button" aria-pressed={filter === option.key} onClick={() => updateFilter(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
        <label className="review-memo-toggle"><input type="checkbox" checked={memoOnly} onChange={(event) => updateFilter(filter, event.target.checked)} /> 메모 있음</label>
        <span>이후 차이는 실제 성과가 아니라 동일 가정의 가상 경로 비교입니다.</span>
      </section>

      <section className="review-list-section" aria-labelledby="review-list-title">
        <div className="review-section-head"><h2 id="review-list-title">결정 이력</h2><span>기준 시각 {formatDateAndMinutes(envelope.dataAsOf)} KST · 화면용 고정 예시</span></div>
        <div className="review-columns" aria-hidden="true"><span>결정</span><span>사용자 결정</span><span>메모</span><span>정책</span><span>검증</span><span>가상 경로</span><span>연결 화면</span></div>
        {filteredDecisions.length ? (
          <div className="review-list" role="listbox" aria-label="사용자 결정 이력">
            {filteredDecisions.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <button className={isSelected ? "review-row selected" : "review-row"} key={item.id} type="button" role="option" aria-selected={isSelected} tabIndex={isSelected ? 0 : -1} onClick={() => setSelectedId(item.id)}>
                  <span><strong>{item.id} · {item.name}</strong><small>{item.ticker} · {formatDateAndMinutes(item.reviewedAt)}</small></span>
                  <span><StatusPill tone={decisionTone(item.decision)}>{item.decision}</StatusPill></span>
                  <span className={item.memo ? "memo-mark" : "muted-mark"}>{item.memo ? "있음" : "없음"}</span>
                  <span>{item.policy}</span>
                  <span>{item.verification}</span>
                  <span>{item.pathDiff}</span>
                  <span>{item.linkPage}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="review-empty-state"><strong>선택한 조건의 결정 이력이 없습니다.</strong><span>상태 필터나 메모 조건을 바꾸면 첫 번째 보이는 결정이 자동 선택됩니다.</span></div>
        )}
      </section>

      <section className="review-compare-section" aria-labelledby="review-compare-title">
        <div className="review-section-head"><h2 id="review-compare-title">당시 판단과 가상 경로 비교</h2><span>{selected ? `${selected.id} · 실제 성과 평가 아님` : "빈 결과 · 실제 성과 평가 아님"}</span></div>
        <div className="review-compare-grid">
          <article><span>당시 사용자 판단</span><strong>{selected?.decision ?? "없음"}</strong><small>{selected?.statusText ?? "필터 조건에 해당 없음"}</small></article>
          <article><span>당시 주요 근거</span><strong>{selected?.focus ?? "미표시"}</strong><small>{selected?.reason ?? "기록 없음"}</small></article>
          <article><span>가상 경로 차이</span><strong>{selected?.pathDiff ?? "미표시"}</strong><small>화면용 가상 경로 비교</small></article>
          <article><span>회고 초점</span><strong>{selected ? (selected.memo ? "메모 있음" : "메모 없음") : "필터 변경"}</strong><small>{selected ? "사용자 기록 확인" : "조건을 바꿔 주세요"}</small></article>
        </div>
        <div className="review-path-panel">
          <div><span>선택한 결정 경로</span><strong>{selected?.chosen ?? "선택 경로 없음"}</strong></div>
          <div><span>비교용 대체 경로</span><strong>{selected?.alternate ?? "비교 경로 없음"}</strong></div>
          <p>{selected?.pathCopy ?? "빈 결과 상태에서도 이전 선택과 링크가 남지 않도록 초기화합니다."}</p>
        </div>
      </section>

      <footer className="review-disclaimer">{decisionReview.safetyCopy} · 실제 성과 회고·투자 판단 채점·투자 권유 아님</footer>
    </section>
  );

  const inspector = (
    <aside className="review-inspector" aria-live="polite">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 결정</span>
          <div className="decision-title">
            <div><h2>{selected ? `${selected.id} · ${selected.name}` : "선택 결정 없음"}</h2><span>{selected?.ticker ?? "필터 결과 없음"}</span></div>
            <StatusPill tone={selected ? decisionTone(selected.decision) : "warning"}>{selected?.decision ?? "빈 결과"}</StatusPill>
          </div>
          <p>{selected?.summary ?? "현재 필터에 해당하는 화면용 결정 이력이 없습니다."}</p>
        </header>

        <section className="inspector-section proposal">
          <h3>당시 기록</h3>
          <dl>
            <div><dt>결정 ID</dt><dd>{selected?.id ?? "미표시"}</dd></div>
            <div><dt>종목</dt><dd>{selected ? `${selected.name} (${selected.ticker})` : "미표시"}</dd></div>
            <div><dt>사용자 결정</dt><dd>{selected?.decision ?? "미표시"}</dd></div>
            <div><dt>기준 시각</dt><dd>{selected ? formatDateAndMinutes(selected.reviewedAt) : "미표시"}</dd></div>
          </dl>
        </section>

        <section className="inspector-section proposal">
          <h3>사용자 메모</h3>
          <p className="review-memo-box">{selected?.memoText ?? "표시할 사용자 메모가 없습니다."}</p>
        </section>

        <section className="inspector-section verification">
          <h3>검증·정책 상태</h3>
          <dl>
            <div><dt>당시 근거</dt><dd>{selected?.reason ?? "미표시"}</dd></div>
            <div><dt>정책 상태</dt><dd>{selected?.policy ?? "미표시"}</dd></div>
            <div><dt>검증 상태</dt><dd>{selected?.verification ?? "미표시"}</dd></div>
            <div><dt>출처 상태</dt><dd>{selected?.source ?? "외부 요청 0건"}</dd></div>
          </dl>
          <div className="warning"><b>회고 경계</b><p>당시 판단 기록을 정리하는 화면이며 투자 판단 채점이 아닙니다.</p></div>
        </section>

        <section className="inspector-section verification">
          <h3>가상 경로 비교</h3>
          <dl>
            <div><dt>선택 경로</dt><dd>{selected?.chosen ?? "미표시"}</dd></div>
            <div><dt>대체 경로</dt><dd>{selected?.alternate ?? "미표시"}</dd></div>
            <div><dt>가상 차이</dt><dd>{selected?.pathDiff ?? "미표시"}</dd></div>
            <div><dt>실제 성과 평가</dt><dd>아님</dd></div>
          </dl>
        </section>

        <section className="inspector-section boundary-box">
          <h3>데이터·실행 경계</h3>
          <p>{decisionReview.safetyCopy}</p>
        </section>
      </div>

      <div className="approval-panel review-actions">
        <div className="expiry">
          <span>{selected ? `${selected.id}의 관련 기록으로 이동해도 금융 행동은 발생하지 않습니다.` : "현재 연결할 결정 기록이 없습니다."}</span>
          <small>실제 주문·체결 아님 · 실제 성과 회고 아님</small>
        </div>
        <button type="button" disabled={!selected} onClick={() => selected && onNavigate(selected.linkPage)}>
          관련 화면 보기 <ArrowRight size={14} />
        </button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 로컬 fixture · 외부 요청 {envelope.externalConnections}건</p>
      </div>
    </aside>
  );

  return <AppShell title="결정 회고" accountLabel="시뮬레이션 계좌" lastSync={lastSync} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}
