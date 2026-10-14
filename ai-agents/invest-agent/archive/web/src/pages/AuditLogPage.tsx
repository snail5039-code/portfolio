import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { getAuditLogs } from "../api/auditLogs";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { AuditDecisionRow, AuditLogData, PageKey } from "../types/dashboard";
import "./AuditLogPage.css";

type AuditStepKey = "analysis" | "verification" | "approval";
type AuditSourceKey = "metrics" | "filing" | "policy";

interface AuditLogPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

type InspectorMode =
  | { type: "step"; key: AuditStepKey }
  | { type: "source"; key: AuditSourceKey };

const timeline: Array<{ key: AuditStepKey; title: string; note: string; done: boolean }> = [
  { key: "analysis", title: "14:28 분석 완료", note: "제안 생성 예시", done: true },
  { key: "verification", title: "14:31 검증 완료", note: "형식·정책 비교", done: true },
  { key: "approval", title: "14:32 승인 대기", note: "실제 주문 없음", done: false }
];

const sourceCards: Array<{ key: AuditSourceKey; title: string; note: string; state: string }> = [
  { key: "metrics", title: "재무 수치 가상 8개", note: "8개 형식 일치 · 사실성 미확인", state: "형식 일치" },
  { key: "filing", title: "공시 원문", note: "실제 공시 미연결 · 미확인", state: "원문 미확인" },
  { key: "policy", title: "정책 규칙 화면 예시", note: "가상 한도·비중·가격 조건", state: "예시 규칙" }
];

export function AuditLogPage({ activePage, onNavigate }: AuditLogPageProps) {
  const state = useFixture<AuditLogData>(() => getAuditLogs(), "audit-logs");
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [changesOnly, setChangesOnly] = useState(false);
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>({ type: "step", key: "verification" });

  const fallback = renderFixtureFallback(state, "감사 로그");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const auditLogData = envelope.data;
  const decision = auditLogData.decisions.find((item) => item.id === decisionId) ?? auditLogData.decisions[0];
  const detail = inspectorMode.type === "step" ? auditLogData.steps[inspectorMode.key] : auditLogData.sources[inspectorMode.key];

  const rows = auditLogData.labels
    .map((label, index) => ({
      label,
      before: decision.initial[index],
      after: decision.verified[index],
      changed: decision.changed[index]
    }))
    .filter((row) => !changesOnly || row.changed);

  function selectDecision(item: AuditDecisionRow) {
    setDecisionId(item.id);
  }

  const main = (
    <section className="audit-main" aria-labelledby="audit-title">
      <header className="audit-header">
        <div>
          <span className="eyebrow">감사 로그</span>
          <h1 id="audit-title">에이전트 실행 기록</h1>
          <p>내부 추론이 아닌 입력·결과·검증 상태만 표시합니다.</p>
        </div>
        <div>
          <b>외부 데이터 연결 없음</b>
          <small>투자 판단·주문 사용 금지</small>
        </div>
      </header>

      <div className="audit-decisions" role="listbox" aria-label="결정 선택">
        {auditLogData.decisions.map((item) => (
          <button
            key={item.id}
            type="button"
            role="option"
            aria-selected={decision.id === item.id}
            onClick={() => selectDecision(item)}
          >
            <small>{item.id}</small>
            <b>{item.company}</b>
            <StatusPill tone={item.tone}>{item.status}</StatusPill>
          </button>
        ))}
      </div>

      <section className="audit-timeline" aria-labelledby="timeline-title">
        <h2 id="timeline-title">처리 타임라인 <small>단계 선택 시 상세 갱신</small></h2>
        <div role="listbox" aria-label="처리 단계">
          {timeline.map((step, index) => (
            <div className="timeline-node" key={step.key}>
              <button
                type="button"
                role="option"
                aria-selected={inspectorMode.type === "step" && inspectorMode.key === step.key}
                onClick={() => setInspectorMode({ type: "step", key: step.key })}
              >
                <span className="step-icon" aria-hidden="true">{step.done ? "✓" : "○"}</span>
                <span className="step-copy"><b>{step.title}</b><small>{step.note}</small></span>
              </button>
              {index < timeline.length - 1 ? <i aria-hidden="true" /> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="audit-compare" aria-labelledby="audit-compare-title">
        <header>
          <h2 id="audit-compare-title">최초 제안과 검증 후 결과</h2>
          <label><input type="checkbox" checked={changesOnly} onChange={(event) => setChangesOnly(event.currentTarget.checked)} /> 변경된 항목만 보기</label>
        </header>
        <div className="compare-head" aria-hidden="true"><span>항목</span><b>최초 제안</b><b>검증 후 결과</b></div>
        <div className="compare-rows">
          {rows.map((row) => (
            <div className={row.changed ? "compare-row changed" : "compare-row"} key={row.label}>
              <span>{row.label}</span>
              <b>{row.before}</b>
              <b className="after">{row.after}</b>
            </div>
          ))}
        </div>
        <p>형식 비교용 가상 결과이며 실제 검증 완료나 사실 확정을 의미하지 않습니다.</p>
      </section>

      <section className="audit-sources" aria-labelledby="sources-title">
        <header>
          <h2 id="sources-title">사용 데이터·출처</h2>
          <span>형식 일치와 원문 확인을 구분</span>
        </header>
        <div role="listbox" aria-label="출처 선택">
          {sourceCards.map((source) => (
            <button
              key={source.key}
              type="button"
              role="option"
              aria-selected={inspectorMode.type === "source" && inspectorMode.key === source.key}
              onClick={() => setInspectorMode({ type: "source", key: source.key })}
            >
              <b>{source.title}</b>
              <small>{source.note}</small>
              <strong>{source.state}</strong>
            </button>
          ))}
        </div>
      </section>
    </section>
  );

  const inspector = (
    <aside className="audit-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span>선택 단계 상세</span>
          <h2>{detail.title}</h2>
          <p>{detail.type}</p>
        </header>
        <section><h3>입력</h3><p>{detail.input}</p></section>
        <section><h3>결과</h3><p>{detail.result}</p></section>
        <section>
          <h3>검증 상태</h3>
          <dl>
            <div><dt>형식 검사</dt><dd>일치 예시</dd></div>
            <div><dt>원문 확인</dt><dd>미수행</dd></div>
            <div><dt>사실 확정</dt><dd>아님</dd></div>
          </dl>
        </section>
        <section className="audit-risk"><h3>위험·미확인</h3><p>{detail.risk}</p></section>
        <section>
          <h3>감사 메타데이터</h3>
          <dl>
            <div><dt>결정 ID</dt><dd>{decision.id}</dd></div>
            <div><dt>실행 ID</dt><dd>{decision.runId}</dd></div>
            <div><dt>기준시각</dt><dd>{formatDateAndMinutes(envelope.dataAsOf)} KST</dd></div>
            <div><dt>외부데이터</dt><dd>없음</dd></div>
          </dl>
        </section>
      </div>
      <footer>
        {decision.id === "DEC-1042" ? (
          <button type="button" onClick={() => onNavigate("approvals")}>
            DEC-1042 승인 대기 화면 보기 <ArrowRight size={13} />
          </button>
        ) : (
          <p>{decision.id}은 이 목업에서 별도 승인 대기 링크를 표시하지 않습니다.</p>
        )}
        <button type="button" onClick={() => onNavigate("dashboard")}>대시보드 복귀</button>
        <small>{auditLogData.safetyCopy}</small>
      </footer>
    </aside>
  );

  return (
    <AppShell
      title="감사 로그"
      accountLabel="시뮬레이션 계좌"
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
