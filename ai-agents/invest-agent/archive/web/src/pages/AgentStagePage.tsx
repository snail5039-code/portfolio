import { useState } from "react";
import { ArrowRight, Ban, CheckCircle2, CircleDot, Clock, ShieldAlert } from "lucide-react";
import { getAgentStage } from "../api/agents";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { AgentScreenData, AgentStage, AgentStageStep, PageKey } from "../types/dashboard";
import "./AgentStagePage.css";

/**
 * One screen shared by 분석 / 검증 / 실행 에이전트.
 *
 * The three are stage views of a single pipeline, so they read the same shape
 * and differ only in fixture content. Keeping them on one component means the
 * safety boundary — capabilities are 미연결, work items end at a user decision —
 * is rendered identically on all three.
 */

function stepIcon(state: AgentStageStep["state"]) {
  if (state === "done") return <CheckCircle2 size={12} />;
  if (state === "current") return <CircleDot size={12} />;
  if (state === "blocked") return <Ban size={12} />;
  return <Clock size={12} />;
}

const STEP_STATE_LABEL: Record<AgentStageStep["state"], string> = {
  done: "완료",
  current: "진행",
  waiting: "대기",
  blocked: "차단"
};

interface AgentStagePageProps {
  stage: AgentStage;
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function AgentStagePage({ stage, activePage, onNavigate }: AgentStagePageProps) {
  const state = useFixture<AgentScreenData>(() => getAgentStage(stage), `agents:${stage}`);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "에이전트");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const agent = envelope.data;
  const selected = agent.items.find((item) => item.id === selectedId) ?? agent.items[0];
  const approvalCount = agent.items.filter((item) => item.userApprovalRequired).length;

  const main = (
    <section className="agent-main" aria-labelledby="agent-title">
      <header className="agent-summary">
        <div>
          <span className="eyebrow">{agent.stage === "execution" ? "실행 경계 점검" : "에이전트 단계"}</span>
          <h1 id="agent-title">{agent.agentName}</h1>
          <p className="agent-role-summary">{agent.roleSummary}</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="agent-pipeline" aria-label="에이전트 파이프라인">
        {agent.pipeline.map((step, index) => (
          <article
            className={`agent-step ${step.state}${step.stage === agent.stage ? " viewing" : ""}`}
            key={step.stage}
          >
            <span className="agent-step-head">
              <i aria-hidden="true">{stepIcon(step.state)}</i>
              <strong>{index + 1}. {step.label}</strong>
              <em>{STEP_STATE_LABEL[step.state]}</em>
            </span>
            <small>{step.detail}</small>
          </article>
        ))}
      </section>

      <section className="agent-kpis" aria-label="에이전트 상태 요약">
        {agent.metrics.map((metric) => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong className={`tone-${metric.tone}`}>{metric.value}</strong>
          </div>
        ))}
      </section>

      <div className="agent-columns">
        <section className="agent-block" aria-labelledby="agent-items-title">
          <div className="agent-section-head">
            <h2 id="agent-items-title">{agent.stage === "execution" ? "실행 후보" : "처리 목록"}</h2>
            <span>{agent.items.length}건 · 사용자 승인 필요 {approvalCount}건</span>
          </div>
          <div className="agent-list" role="listbox" aria-label="처리 목록">
            {agent.items.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <button
                  className={isSelected ? "agent-row selected" : "agent-row"}
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="agent-row-main">
                    <strong>{item.title}</strong>
                    <small>{item.subtitle} · {item.decisionId}</small>
                  </span>
                  <span className="agent-row-side">
                    <StatusPill tone={item.statusTone}>{item.status}</StatusPill>
                    <small>{item.userApprovalRequired ? "승인 필요" : "승인 불필요"}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="agent-block" aria-labelledby="agent-capability-title">
          <div className="agent-section-head">
            <h2 id="agent-capability-title">기능 연결 상태</h2>
            <span>전 항목 미연결</span>
          </div>
          <ul className="agent-capability-list">
            {agent.capabilities.map((capability) => (
              <li key={capability.label}>
                <span className="agent-capability-head">
                  <strong>{capability.label}</strong>
                  <em>미연결</em>
                </span>
                <p>{capability.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="agent-disclaimer">{agent.safetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="agent-inspector" aria-label="선택 항목 상세" aria-live="polite">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 항목</span>
          <div className="decision-title">
            <div>
              <h2>{selected?.title ?? "선택 항목 없음"}</h2>
              <span>{selected?.decisionId ?? "표시할 결정 없음"}</span>
            </div>
            <StatusPill tone={selected?.statusTone ?? "neutral"}>{selected?.action ?? "없음"}</StatusPill>
          </div>
          <p>{selected?.summary ?? "표시할 항목이 없습니다."}</p>
        </header>

        {agent.executionGrade ? (
          <section className="inspector-section verification">
            <h3>실행 등급</h3>
            <div className="agent-grade-box">
              <strong>{agent.executionGrade}</strong>
              <p>사용자 승인 없이는 어떤 주문도 만들어지지 않습니다. 이 화면의 실행 건수는 항상 0건입니다.</p>
            </div>
          </section>
        ) : null}

        <section className="inspector-section proposal">
          <h3>{agent.stage === "analysis" ? "투자 제안서" : agent.stage === "verification" ? "감사 결과" : "실행 전 확인"}</h3>
          <dl className="agent-field-list">
            {(selected?.fields ?? []).map((field) => (
              <div key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="inspector-section verification">
          <h3>확인 사항</h3>
          <ul className="agent-note-list">
            {(selected?.notes ?? []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <div className="warning">
            <b>상태 경계</b>
            <p>표시는 역할 분리 구조 확인용이며 실제 에이전트 실행 결과가 아닙니다.</p>
          </div>
        </section>

        <section className="inspector-section verification">
          <h3>사용자 승인 경계</h3>
          <dl>
            <div><dt>사용자 승인 필요</dt><dd>{selected?.userApprovalRequired ? "예" : "아니오"}</dd></div>
            <div><dt>실행된 금융 행동</dt><dd>없음</dd></div>
            <div><dt>외부 요청</dt><dd>{envelope.externalConnections}건</dd></div>
            <div><dt>기준 시각</dt><dd>{formatDateAndMinutes(envelope.dataAsOf)}</dd></div>
          </dl>
        </section>

        <section className="inspector-section boundary-box">
          <h3>데이터·실행 경계</h3>
          <p>{agent.safetyCopy}</p>
        </section>
      </div>

      <div className="approval-panel agent-actions">
        <div className="expiry">
          <span>관련 화면으로 이동해도 외부 요청이나 금융 행동은 발생하지 않습니다.</span>
          <small>실제 AI 실행·외부 에이전트 실행 아님</small>
        </div>
        <button type="button" disabled={!selected} onClick={() => selected && onNavigate(selected.linkPage)}>
          {selected?.linkLabel ?? "관련 화면 보기"} <ArrowRight size={14} />
        </button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 로컬 fixture · 실행 {envelope.executed ? "있음" : "0건"}</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title={agent.title}
      accountLabel="시뮬레이션 계좌"
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
