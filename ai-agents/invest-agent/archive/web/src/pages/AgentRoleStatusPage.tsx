import { ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getAgentRoleStatus } from "../api/agentRoleStatus";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatTimeOfDay } from "../lib/format";
import type { AgentRoleState, AgentRoleStatusData, AgentRoleStatusItem, PageKey, Tone } from "../types/dashboard";
import "./AgentRoleStatusPage.css";

type AgentRoleStatusFilter = "all" | AgentRoleState | "none";

declare global {
  interface Window {
    __setAgentRoleStatusFilterForTest?: (filter: AgentRoleStatusFilter) => void;
  }

  var __setAgentRoleStatusFilterForTest: ((filter: AgentRoleStatusFilter) => void) | undefined;
}

type AgentRoleStatusTestWindow = Window & typeof globalThis & {
  __setAgentRoleStatusFilterForTest?: (filter: AgentRoleStatusFilter) => void;
};

const filterOptions: Array<{ key: AgentRoleStatusFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "대기", label: "대기" },
  { key: "승인 필요", label: "승인 필요" },
  { key: "실패 이력", label: "실패 이력" }
];

function roleTone(status: AgentRoleStatusItem["status"]): Tone {
  if (status === "대기") return "info";
  if (status === "승인 필요") return "warning";
  return "danger";
}

interface AgentRoleStatusPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function AgentRoleStatusPage({ activePage, onNavigate }: AgentRoleStatusPageProps) {
  const state = useFixture<AgentRoleStatusData>(() => getAgentRoleStatus(), "agent-role-status");
  const [filter, setFilter] = useState<AgentRoleStatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // See TaxFeeImpactPage for why this indirection exists: hooks must run
  // unconditionally, but the real handler needs data only available after load.
  const testHookRef = useRef<(filter: AgentRoleStatusFilter) => void>(() => {});

  useEffect(() => {
    const forward = (nextFilter: AgentRoleStatusFilter) => testHookRef.current(nextFilter);
    Object.defineProperty(window, "__setAgentRoleStatusFilterForTest", { configurable: true, writable: true, value: forward });
    Object.defineProperty(self as AgentRoleStatusTestWindow, "__setAgentRoleStatusFilterForTest", { configurable: true, writable: true, value: forward });

    return () => {
      delete window.__setAgentRoleStatusFilterForTest;
      delete (self as AgentRoleStatusTestWindow).__setAgentRoleStatusFilterForTest;
    };
  }, []);

  const fallback = renderFixtureFallback(state, "역할 상태");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const agentRoleStatus = envelope.data;

  function visibleRoles(nextFilter: AgentRoleStatusFilter) {
    if (nextFilter === "none") return [];
    return agentRoleStatus.roles.filter((item) => nextFilter === "all" || item.status === nextFilter);
  }

  const filteredRoles = visibleRoles(filter);
  const selected = filteredRoles.find((item) => item.id === selectedId) ?? filteredRoles[0] ?? null;
  const approvalCount = filteredRoles.filter((item) => item.approval).length;
  const lastSync = formatTimeOfDay(envelope.dataAsOf);

  testHookRef.current = (nextFilter: AgentRoleStatusFilter) => {
    const nextVisible = visibleRoles(nextFilter);
    setFilter(nextFilter);
    setSelectedId(nextVisible[0]?.id ?? "");
  };

  function updateFilter(nextFilter: AgentRoleStatusFilter) {
    const nextVisible = visibleRoles(nextFilter);
    setFilter(nextFilter);
    if (!nextVisible.some((item) => item.id === selectedId)) {
      setSelectedId(nextVisible[0]?.id ?? "");
    }
  }

  const timelineLabels = selected
    ? ["후보 작성", selected.role === "검증자" ? "선택 역할 점검" : "출처 신뢰도 점검", selected.role === "정책 감시자" ? "선택 역할 점검" : "한도·집중도 비교", selected.role === "승인 관리자" ? "선택 역할 점검" : "사용자 확인 항목 정리"]
    : ["후보 없음", "검증 없음", "정책 없음", "승인 없음"];

  const main = (
    <section className="role-main" aria-labelledby="role-title">
      <header className="role-summary">
        <button className="test-hook-marker" data-test-hook="window.__setAgentRoleStatusFilterForTest('none')" type="button" onClick={() => testHookRef.current("none")}>
          window.__setAgentRoleStatusFilterForTest('none')
        </button>
        <div>
          <span className="eyebrow">역할 분리 구조 점검</span>
          <h1 id="role-title">{filteredRoles.length ? `${filteredRoles.length}개 역할 가상 상태` : "선택한 조건의 역할 상태 없음"}</h1>
          <p>{filteredRoles.length ? "제안·검증·정책 감시·승인 정리 역할을 분리해 승인 전 대기 사유와 충돌 이력을 봅니다." : "필터 조건에 맞는 역할이 없으면 이전 선택과 관련 링크를 남기지 않습니다."}</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="role-kpis" aria-label="역할 상태 요약">
        <div><span>표시 역할</span><strong>{filteredRoles.length}개</strong></div>
        <div><span>사용자 승인 필요</span><strong>{approvalCount}개</strong></div>
        <div><span>실행 상태</span><strong>{envelope.executed ? "실행됨" : "실행 안 됨"}</strong></div>
        <div><span>외부 요청</span><strong>{envelope.externalConnections}건</strong></div>
      </section>

      <section className="role-toolbar" aria-label="역할 상태 필터">
        <div className="segments role-filters" role="group" aria-label="역할 상태">
          {filterOptions.map((option) => (
            <button className={filter === option.key ? "selected" : ""} key={option.key} type="button" aria-pressed={filter === option.key} onClick={() => updateFilter(option.key)}>
              {option.label}
            </button>
          ))}
        </div>
        <span>기준 시각 {formatTimeOfDay(envelope.dataAsOf)} KST · 실제 AI 실행 상태나 외부 에이전트 연결 아님</span>
      </section>

      <section className="role-list-section" aria-labelledby="role-list-title">
        <div className="role-section-head"><h2 id="role-list-title">역할별 현재 상태</h2><span>화면용 상태판이며 금융 행동을 수행하지 않습니다.</span></div>
        <div className="role-columns" aria-hidden="true"><span>역할</span><span>현재 상태</span><span>마지막 작업</span><span>대기 사유</span><span>승인</span><span>연결 이력</span></div>
        {filteredRoles.length ? (
          <div className="role-list" role="listbox" aria-label="역할 상태 목록">
            {filteredRoles.map((item) => {
              const isSelected = selected?.id === item.id;
              return (
                <button className={isSelected ? "role-row selected" : "role-row"} key={item.id} type="button" role="option" aria-selected={isSelected} tabIndex={isSelected ? 0 : -1} onClick={() => setSelectedId(item.id)}>
                  <span><strong>{item.role}</strong><small>{item.decision}</small></span>
                  <span><StatusPill tone={roleTone(item.status)}>{item.status}</StatusPill></span>
                  <span><strong>{item.task}</strong><small>화면용 샘플</small></span>
                  <span>{item.wait}</span>
                  <span className={item.approval ? "approval-mark" : "muted-mark"}>{item.approval ? "필요" : "없음"}</span>
                  <span>{item.history}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="role-empty-state"><strong>선택한 조건의 역할 상태가 없습니다.</strong><span>필터를 바꾸면 첫 번째 보이는 역할과 관련 링크가 다시 설정됩니다.</span></div>
        )}
      </section>

      <section className="role-timeline-section" aria-labelledby="role-timeline-title">
        <div className="role-section-head"><h2 id="role-timeline-title">역할 간 상태·충돌 타임라인</h2><span>{selected ? `${selected.decision} · ${selected.role} 선택` : "빈 결과 · 연결 이력 없음"}</span></div>
        <div className="role-handoff-strip" aria-label="역할 흐름">
          {["제안자", "검증자", "정책 감시자", "승인 관리자"].map((label, index) => (
            <article className={selected?.role === label ? "selected" : ""} key={label}>
              <span>{index + 1}</span>
              <strong>{label}</strong>
              <small>{timelineLabels[index]}</small>
            </article>
          ))}
        </div>
        {selected ? (
          <div className="role-timeline-grid">
            <article><span>DEC-1057</span><strong>출처 신뢰도 보강 요청</strong><p>NAVER 관찰 유지 예시를 검증 실패 이력으로 연결합니다.</p></article>
            <article><span>DEC-1052</span><strong>비용 영향 재검토</strong><p>세금·수수료 점검 후 SK하이닉스 반려 기록을 연결합니다.</p></article>
            <article><span>DEC-1042</span><strong>조건부 승인 기록</strong><p>삼성전자 승인 대기와 감사 로그 기록을 참조합니다.</p></article>
          </div>
        ) : (
          <div className="role-timeline-empty">
            <strong>표시할 흐름 없음</strong>
            <p>선택 역할이 없으므로 실제 결정 ID처럼 보일 수 있는 타임라인 카드를 비웁니다.</p>
          </div>
        )}
      </section>

      <footer className="role-disclaimer">{agentRoleStatus.safetyCopy} · 표시된 역할 상태는 실제 AI 실행 또는 외부 에이전트 실행 아님</footer>
    </section>
  );

  const inspector = (
    <aside className="role-inspector" aria-live="polite">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 역할</span>
          <div className="decision-title">
            <div><h2>{selected?.role ?? "선택 역할 없음"}</h2><span>{selected?.decision ?? "필터 결과 없음"}</span></div>
            <StatusPill tone={selected ? roleTone(selected.status) : "warning"}>{selected?.badge ?? "빈 결과"}</StatusPill>
          </div>
          <p>{selected?.summary ?? "현재 필터에 해당하는 화면용 역할 상태가 없습니다."}</p>
        </header>

        <section className="inspector-section proposal">
          <h3>현재 역할</h3>
          <dl>
            <div><dt>역할</dt><dd>{selected?.role ?? "미표시"}</dd></div>
            <div><dt>현재 상태</dt><dd>{selected?.status ?? "미표시"}</dd></div>
            <div><dt>결정 ID</dt><dd>{selected?.decision ?? "미표시"}</dd></div>
            <div><dt>기준 시각</dt><dd>{formatTimeOfDay(envelope.dataAsOf)} KST</dd></div>
          </dl>
        </section>

        <section className="inspector-section proposal">
          <h3>마지막 작업</h3>
          <p className="role-task-box">{selected?.task ?? "표시할 마지막 작업이 없습니다."}</p>
        </section>

        <section className="inspector-section verification">
          <h3>대기·충돌 사유</h3>
          <dl>
            <div><dt>대기 사유</dt><dd>{selected?.wait ?? "미표시"}</dd></div>
            <div><dt>충돌·반려 이력</dt><dd>{selected?.history ?? "미표시"}</dd></div>
            <div><dt>상태 설명</dt><dd>{selected?.conflict ?? "미표시"}</dd></div>
          </dl>
          <div className="warning"><b>상태 경계</b><p>표시는 역할 분리 구조 확인용이며 실제 에이전트 실행 상태가 아닙니다.</p></div>
        </section>

        <section className="inspector-section verification">
          <h3>사용자 승인 경계</h3>
          <dl>
            <div><dt>사용자 승인 필요</dt><dd>{selected ? (selected.approval ? "예시 표시" : "현재 없음") : "미표시"}</dd></div>
            <div><dt>금융 행동</dt><dd>수행 안 함</dd></div>
            <div><dt>승인 권한</dt><dd>사용자 최종 통제</dd></div>
          </dl>
        </section>

        <section className="inspector-section boundary-box">
          <h3>데이터·실행 경계</h3>
          <p>{agentRoleStatus.safetyCopy}</p>
        </section>
      </div>

      <div className="approval-panel role-actions">
        <div className="expiry">
          <span>{selected ? `${selected.history} 관련 화면으로 이동해도 외부 요청이나 금융 행동은 발생하지 않습니다.` : "현재 연결할 역할 기록이 없습니다."}</span>
          <small>실제 AI 실행 상태·외부 에이전트 실행 아님</small>
        </div>
        <button type="button" disabled={!selected} onClick={() => selected && onNavigate(selected.linkPage)}>
          {selected?.linkLabel ?? "관련 화면 보기"} <ArrowRight size={14} />
        </button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 로컬 fixture · 외부 요청 {envelope.externalConnections}건</p>
      </div>
    </aside>
  );

  return <AppShell title="역할 상태" accountLabel="시뮬레이션 계좌" lastSync={lastSync} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}
