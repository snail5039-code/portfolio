import { useMemo, useState } from "react";
import { getRiskAlerts } from "../api/riskAlerts";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatTimeOfDay } from "../lib/format";
import type { RiskAlertsData, RiskCategory, RiskEvent, RiskSeverity, PageKey } from "../types/dashboard";
import "./RiskAlertsPage.css";

type SeverityFilter = "all" | RiskSeverity;
type CategoryFilter = "all" | RiskCategory;

interface RiskAlertsPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function RiskAlertsPage({ activePage, onNavigate }: RiskAlertsPageProps) {
  const state = useFixture<RiskAlertsData>(() => getRiskAlerts(), "risk-alerts");
  const [severity, setSeverity] = useState<SeverityFilter>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "리스크 알림");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const riskEvents = envelope.data.events;

  const visibleEvents = riskEvents.filter(
    (event) => (severity === "all" || event.severity === severity) && (category === "all" || event.category === category)
  );
  const selectedEvent = visibleEvents.find((event) => event.id === selectedId) ?? visibleEvents[0] ?? null;

  function updateSeverity(nextSeverity: SeverityFilter) {
    const nextVisible = riskEvents.filter(
      (event) => (nextSeverity === "all" || event.severity === nextSeverity) && (category === "all" || event.category === category)
    );
    setSeverity(nextSeverity);
    setSelectedId(nextVisible[0]?.id ?? "");
  }

  function updateCategory(nextCategory: CategoryFilter) {
    const nextVisible = riskEvents.filter(
      (event) => (severity === "all" || event.severity === severity) && (nextCategory === "all" || event.category === nextCategory)
    );
    setCategory(nextCategory);
    setSelectedId(nextVisible[0]?.id ?? "");
  }

  const main = (
    <section className="risk-main" aria-labelledby="risk-title">
      <header className="risk-summary">
        <div>
          <span className="eyebrow">위험 이벤트</span>
          <h1 id="risk-title">확인이 필요한 가상 알림</h1>
          <p>정책·출처·시장·승인·데이터 한계를 한곳에서 검토합니다.</p>
        </div>
        <div className="risk-stats" aria-label="이벤트 요약">
          <div><span>전체</span><strong>{riskEvents.length}건</strong></div>
          <div><span>높음</span><strong>{riskEvents.filter((event) => event.severity === "높음").length}건</strong></div>
          <div><span>보통</span><strong>{riskEvents.filter((event) => event.severity === "보통").length}건</strong></div>
          <div><span>대기</span><strong>{riskEvents.filter((event) => event.status.includes("대기")).length}건</strong></div>
        </div>
      </header>

      <section className="risk-filters" aria-label="리스크 이벤트 필터">
        <div>
          <span>심각도</span>
          <div className="segments">
            {(["all", "중대", "높음", "보통", "낮음"] as SeverityFilter[]).map((value) => (
              <button className={severity === value ? "selected" : ""} key={value} type="button" aria-pressed={severity === value} onClick={() => updateSeverity(value)}>
                {value === "all" ? "전체" : value}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>카테고리</span>
          <div className="segments risk-category-filters">
            {(["all", "정책", "출처", "시장", "승인", "데이터"] as CategoryFilter[]).map((value) => (
              <button className={category === value ? "selected" : ""} key={value} type="button" aria-pressed={category === value} onClick={() => updateCategory(value)}>
                {value === "all" ? "전체" : value}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="event-section" aria-labelledby="event-title">
        <div className="event-head"><h2 id="event-title">화면용 이벤트 목록</h2><span>표시 {visibleEvents.length}건 · 기준 시각 {formatTimeOfDay(envelope.dataAsOf)} KST</span></div>
        <div className="event-columns" aria-hidden="true"><span>이벤트 / 시각</span><span>알림</span><span>결정 ID</span><span>카테고리</span><span>심각도</span><span>상태</span></div>
        {visibleEvents.length ? (
          <div className="event-list" role="listbox" aria-label="리스크 이벤트 목록">
            {visibleEvents.map((event) => (
              <RiskEventRow key={event.id} event={event} selected={selectedEvent?.id === event.id} onSelect={setSelectedId} />
            ))}
          </div>
        ) : (
          <div className="risk-empty-state">
            <strong>선택한 조건의 화면용 알림이 없습니다.</strong>
            <span>심각도 또는 카테고리 필터를 변경해 주세요.</span>
          </div>
        )}
      </section>
      <footer className="risk-disclaimer">{envelope.data.safetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="risk-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">선택 이벤트</span>
          <div className="risk-inspector-title">
            <h2>{selectedEvent ? `${selectedEvent.id} · ${selectedEvent.title}` : "선택 이벤트 없음"}</h2>
            <span>{selectedEvent?.severity ?? "빈 결과"}</span>
          </div>
          <p>{selectedEvent?.summary ?? "필터를 변경하면 화면용 이벤트 상세를 확인할 수 있습니다."}</p>
        </header>
        {selectedEvent ? <RiskEventDetail event={selectedEvent} /> : <EmptyRiskDetail />}
        <nav className="risk-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          {selectedEvent ? (
            <>
              <button type="button" disabled={!selectedEvent.linkPage} onClick={() => selectedEvent.linkPage && onNavigate(selectedEvent.linkPage)}>{selectedEvent.linkText}<span>{selectedEvent.linkPage ? "›" : "비활성"}</span></button>
              <button type="button" onClick={() => onNavigate("trades")}>모의 거래 내역 보기<span>›</span></button>
              <button type="button" onClick={() => onNavigate("audit")}>감사 로그 보기<span>›</span></button>
              <button type="button" onClick={() => onNavigate("policy")}>투자 정책 보기<span>›</span></button>
              <button type="button" onClick={() => onNavigate("data")}>데이터 연결 보기<span>›</span></button>
            </>
          ) : (
            <p>표시할 이벤트가 없어 관련 링크를 안전하게 비활성화했습니다.</p>
          )}
        </nav>
      </div>
      <footer>{envelope.data.safetyCopy}</footer>
    </aside>
  );

  return <AppShell title="리스크 알림" accountLabel="시뮬레이션 계좌" lastSync={formatTimeOfDay(envelope.dataAsOf)} activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}

function RiskEventRow({ event, selected, onSelect }: { event: RiskEvent; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <button className={selected ? "event-row selected" : "event-row"} type="button" role="option" aria-selected={selected} data-severity={event.severity} onClick={() => onSelect(event.id)}>
      <span><strong>{event.id}</strong><small>08.26 {event.occurredAt}</small></span>
      <span><strong>{event.title}</strong><small>화면용 가상 알림</small></span>
      <span>{event.decisionRef}</span>
      <span>{event.category}</span>
      <span className="severity">{event.severity}</span>
      <span className="event-status">{event.status}</span>
    </button>
  );
}

function RiskEventDetail({ event }: { event: RiskEvent }) {
  return (
    <>
      <section><h3>이벤트 상태</h3><dl><div><dt>심각도</dt><dd>{event.severity}</dd></div><div><dt>카테고리</dt><dd>{event.category}</dd></div><div><dt>관련 결정</dt><dd>{event.decisionRef}</dd></div><div><dt>상태</dt><dd>{event.status}</dd></div></dl></section>
      <section><h3>원인과 사용자 확인</h3><div className="cause-box"><strong>원인</strong><p>{event.cause}</p></div><div className="check-box"><strong>권장 사용자 확인</strong><p>{event.action}</p></div></section>
      <section><h3>정책과 안전 경계</h3><dl><div><dt>관련 정책</dt><dd>{event.policy}</dd></div><div><dt>데이터 상태</dt><dd>미연결</dd></div><div><dt>외부 요청</dt><dd>0건</dd></div><div><dt>실제 주문·계좌</dt><dd>없음</dd></div></dl></section>
    </>
  );
}

function EmptyRiskDetail() {
  return (
    <>
      <section><h3>이벤트 상태</h3><dl><div><dt>표시 이벤트</dt><dd>0건</dd></div><div><dt>외부 요청</dt><dd>0건</dd></div></dl></section>
      <section><h3>원인과 사용자 확인</h3><div className="cause-box"><strong>원인</strong><p>표시할 가상 이벤트가 없습니다.</p></div><div className="check-box"><strong>권장 사용자 확인</strong><p>심각도 또는 카테고리 필터를 변경하세요.</p></div></section>
      <section><h3>정책과 안전 경계</h3><dl><div><dt>관련 정책</dt><dd>표시 대상 없음</dd></div><div><dt>실제 주문·계좌</dt><dd>없음</dd></div></dl></section>
    </>
  );
}
