import { useState } from "react";
import { getPortfolioHealth } from "../api/portfolioHealth";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatTimeOfDay } from "../lib/format";
import type { HealthCheck, HealthGroupKey, HealthStatus, PageKey, PortfolioHealthData } from "../types/dashboard";
import "./PortfolioHealthPage.css";

type StatusFilter = "all" | HealthStatus;
type GroupFilter = "all" | HealthGroupKey;

interface PortfolioHealthPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function PortfolioHealthPage({ activePage, onNavigate }: PortfolioHealthPageProps) {
  const state = useFixture<PortfolioHealthData>(() => getPortfolioHealth(), "portfolio-health");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [groupFilter, setGroupFilter] = useState<GroupFilter>("all");
  const [selectedId, setSelectedId] = useState("H-101");

  const fallback = renderFixtureFallback(state, "포트폴리오 건강");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const { groups: healthGroups, checks: healthChecks, overallScore: score, safetyCopy } = envelope.data;

  const groups = healthGroups.filter((group) => groupFilter === "all" || group.key === groupFilter);
  const checks = healthChecks.filter((item) => (statusFilter === "all" || item.status === statusFilter) && (groupFilter === "all" || item.group === groupFilter));
  const selected = checks.find((item) => item.id === selectedId) ?? checks[0] ?? null;
  const needs = checks.filter((item) => item.status === "확인 필요").length;
  const blocked = checks.filter((item) => item.status === "차단").length;
  const done = checks.filter((item) => item.status === "완료").length;

  function updateStatus(nextStatus: StatusFilter) {
    const nextChecks = healthChecks.filter((item) => (nextStatus === "all" || item.status === nextStatus) && (groupFilter === "all" || item.group === groupFilter));
    setStatusFilter(nextStatus);
    setSelectedId(nextChecks[0]?.id ?? "");
  }

  function updateGroup(nextGroup: GroupFilter) {
    const nextChecks = healthChecks.filter((item) => (statusFilter === "all" || item.status === statusFilter) && (nextGroup === "all" || item.group === nextGroup));
    setGroupFilter(nextGroup);
    setSelectedId(nextChecks[0]?.id ?? "");
  }

  const main = (
    <section className="health-main" aria-labelledby="health-title">
      <header className="health-summary">
        <div>
          <span className="eyebrow">운영 체크리스트</span>
          <h1 id="health-title">포트폴리오 건강 점수 {score}점</h1>
          <p>{checks.length ? `현재 조건에서 ${checks.length}개 화면용 점검 항목을 확인합니다.` : "선택한 조건에 해당하는 화면용 점검 항목이 없습니다."}</p>
        </div>
        <div className="health-score" aria-label="포트폴리오 건강 요약">
          <div className="score-ring"><strong>{score}</strong><span>점</span></div>
          <dl><div><dt>확인 필요</dt><dd>{needs}건</dd></div><div><dt>차단</dt><dd>{blocked}건</dd></div><div><dt>완료</dt><dd>{done}건</dd></div></dl>
        </div>
      </header>
      <section className="health-controls" aria-label="건강 점검 필터">
        <div>
          <span>상태</span>
          <div className="segments" role="group" aria-label="상태">
            {(["all", "확인 필요", "차단", "완료"] as StatusFilter[]).map((value) => (
              <button className={statusFilter === value ? "selected" : ""} key={value} type="button" aria-pressed={statusFilter === value} onClick={() => updateStatus(value)}>{value === "all" ? "전체" : value}</button>
            ))}
          </div>
        </div>
        <div>
          <span>그룹</span>
          <div className="segments" role="group" aria-label="그룹">
            {(["all", "policy", "source", "risk", "approval", "strategy", "stress"] as GroupFilter[]).map((value) => (
              <button className={groupFilter === value ? "selected" : ""} key={value} type="button" aria-pressed={groupFilter === value} onClick={() => updateGroup(value)}>{value === "all" ? "전체" : healthGroups.find((group) => group.key === value)?.label.replace(" 위반", "").replace(" 미확인", "")}</button>
            ))}
          </div>
        </div>
      </section>
      <section className="health-overview" aria-labelledby="health-overview-title">
        <div className="section-head"><h2 id="health-overview-title">점검 그룹</h2><span>{groups.length}개 그룹 · 실제 매수·매도 가능 판정 아님</span></div>
        <div className="health-group-list" role="listbox" aria-label="포트폴리오 건강 점검 그룹">
          {groups.map((group) => (
            <button className={groupFilter === group.key ? "group-card selected" : "group-card"} key={group.key} type="button" role="option" aria-selected={groupFilter === group.key} onClick={() => updateGroup(group.key)}>
              <strong>{group.label}</strong><span className={`state-${statusClass(group.status)}`}>{group.status} · {group.score}점</span><small>{group.summary}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="check-section" aria-labelledby="health-check-title">
        <div className="section-head"><h2 id="health-check-title">운영 체크 항목</h2><span>{checks.length}건 · 실제 실행 없음</span></div>
        <div className="check-columns" aria-hidden="true"><span>항목</span><span>그룹</span><span>상태</span><span>영향</span><span>다음 확인</span></div>
        {checks.length ? (
          <div className="check-list" role="listbox" aria-label="운영 체크 항목">
            {checks.map((item) => {
              const group = healthGroups.find((entry) => entry.key === item.group);
              return (
                <button className={selected?.id === item.id ? "check-row selected" : "check-row"} key={item.id} type="button" role="option" aria-selected={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
                  <span><strong>{item.title}</strong><small>{item.id} · {item.summary}</small></span><span>{group?.label}</span><span><i className={`status-pill ${statusClass(item.status)}`}>{item.status}</i></span><span className={impactClass(item.impact)}>{item.impact}</span><span>{item.next}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty-state"><strong>선택한 조건의 항목이 없습니다.</strong><span>상태 또는 그룹 필터를 바꿔 주세요.</span></div>
        )}
      </section>
      <footer className="health-disclaimer">{safetyCopy}</footer>
    </section>
  );

  const group = healthGroups.find((entry) => entry.key === selected?.group);
  const inspector = (
    <aside className="health-inspector" aria-live="polite" aria-atomic="false">
      <div className="health-inspector-scroll">
        <header>
          <span className="eyebrow">선택 항목</span>
          <div className="health-inspector-title"><h2>{selected?.title ?? "선택 항목 없음"}</h2><span className={selected ? statusClass(selected.status) : "need"}>{selected?.status ?? "빈 결과"}</span></div>
          <p>{selected?.summary ?? "현재 필터에 해당하는 화면용 점검 항목이 없습니다."}</p>
        </header>
        <section>
          <h3>진단 근거</h3>
          <dl><div><dt>점검 ID</dt><dd>{selected?.id ?? "항목 없음"}</dd></div><div><dt>그룹</dt><dd>{group?.label ?? "전체"}</dd></div><div><dt>상태</dt><dd>{selected?.status ?? "미확인"}</dd></div><div><dt>근거</dt><dd>{selected?.basis ?? "필터 결과 없음"}</dd></div></dl>
        </section>
        <section>
          <h3>운영 영향</h3>
          <dl><div><dt>영향도</dt><dd>{selected?.impact ?? "미확인"}</dd></div><div><dt>다음 확인</dt><dd>{selected?.next ?? "필터 변경"}</dd></div><div><dt>위험</dt><dd>{selected?.risk ?? "이전 선택 유지 안 함"}</dd></div></dl>
          <div className="health-note">건강 점수 = max(42, 88 - 차단×10 - 확인필요×4). 실제 성과 개선이나 손실 회피를 보장하지 않습니다.</div>
        </section>
        <section>
          <h3>데이터·실행 경계</h3>
          <dl><div><dt>데이터 상태</dt><dd>{selected?.data ?? "고정 예시"}</dd></div><div><dt>실제 주문</dt><dd>아님</dd></div><div><dt>실제 계좌·API·DB</dt><dd>미연결</dd></div><div><dt>외부 요청</dt><dd>0건</dd></div></dl>
        </section>
        <section className="approval-boundary">
          <h3>승인 전 확인</h3>
          <p>{selected ? `${selected.next} 후에도 이 체크 결과는 실제 매수·매도 가능 판정이 아닙니다.` : "상태 또는 그룹 필터를 바꾸면 첫 번째 보이는 항목이 자동 선택됩니다."}</p>
          {selected ? <button type="button" onClick={() => onNavigate(selected.linkPage)}>관련 화면 보기<span>›</span></button> : null}
        </section>
        <nav className="health-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          <button type="button" onClick={() => onNavigate("approvals")}>승인 대기 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("risks")}>리스크 알림 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("rebalance")}>전략 조정 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("data")}>데이터 연결 보기<span>›</span></button>
        </nav>
      </div>
      <footer>{safetyCopy}</footer>
    </aside>
  );

  return <AppShell title="포트폴리오 건강" accountLabel="시뮬레이션 계좌" lastSync={formatTimeOfDay(envelope.dataAsOf)} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}

function statusClass(status: HealthCheck["status"]) {
  return status === "차단" ? "blocked" : status === "완료" ? "done" : "need";
}

function impactClass(impact: HealthCheck["impact"]) {
  return impact === "높음" ? "impact-high" : impact === "보통" ? "impact-mid" : "impact-low";
}
