import { PlugZap } from "lucide-react";
import { useState } from "react";
import { getDataConnections } from "../api/dataConnections";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatTimeOfDay } from "../lib/format";
import type { DataConnectionKey, DataConnectionsData, PageKey } from "../types/dashboard";
import "./DataConnectionsPage.css";

type DataConnectionFilter = "all" | "blocked" | "mock";

interface DataConnectionsPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function DataConnectionsPage({ activePage, onNavigate }: DataConnectionsPageProps) {
  const state = useFixture<DataConnectionsData>(() => getDataConnections(), "data-connections");
  const [filter, setFilter] = useState<DataConnectionFilter>("all");
  const [selectedKey, setSelectedKey] = useState<DataConnectionKey>("opendart");
  const [checkStatus, setCheckStatus] = useState("아직 점검하지 않았습니다.");

  const fallback = renderFixtureFallback(state, "데이터 연결");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const { cards: dataConnectionCards, rows: dataConnectionRows, details: dataConnectionDetails, qualityChips: dataQualityChips, safetyCopy: dataConnectionsSafetyCopy } = envelope.data;

  const visibleRows = dataConnectionRows.filter((row) => filter === "all" || row.kind === filter);
  const selected = dataConnectionDetails[selectedKey];

  function selectSource(key: DataConnectionKey) {
    setSelectedKey(key);
    setCheckStatus("아직 점검하지 않았습니다.");
  }

  function updateFilter(nextFilter: DataConnectionFilter) {
    const nextRows = dataConnectionRows.filter((row) => nextFilter === "all" || row.kind === nextFilter);
    setFilter(nextFilter);
    if (nextRows.length > 0 && !nextRows.some((row) => row.key === selectedKey)) {
      setSelectedKey(nextRows[0].key);
    }
    setCheckStatus("아직 점검하지 않았습니다.");
  }

  const main = (
    <section className="data-main" aria-labelledby="data-title">
      <header className="data-summary">
        <div>
          <span className="eyebrow">연결 상태</span>
          <h1 id="data-title">실제 데이터 연결 0건</h1>
          <p>공시, 가격, 계좌, 주문, 데이터베이스는 모두 연결하지 않은 화면용 가상 상태입니다.</p>
        </div>
        <div className="data-status-cards">
          {dataConnectionCards.map((card) => (
            <button
              className={selectedKey === card.key ? "data-status-card selected" : "data-status-card"}
              key={card.key}
              type="button"
              aria-pressed={selectedKey === card.key}
              onClick={() => selectSource(card.key)}
            >
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.note}</small>
            </button>
          ))}
        </div>
      </header>

      <section className="data-list" aria-labelledby="data-list-title">
        <div className="data-toolbar">
          <h2 id="data-list-title">연결 대상</h2>
          <div className="segments data-filters" aria-label="연결 상태 필터">
            {[
              ["all", "전체"],
              ["blocked", "차단·미연결"],
              ["mock", "가상"]
            ].map(([key, label]) => (
              <button
                className={filter === key ? "selected" : ""}
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => updateFilter(key as DataConnectionFilter)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="data-source-table" role="listbox" aria-label="데이터 연결 상태 목록">
          {visibleRows.map((row) => (
            <button
              className={selectedKey === row.key ? "data-source-row selected" : "data-source-row"}
              key={row.key}
              type="button"
              role="option"
              aria-selected={selectedKey === row.key}
              onClick={() => selectSource(row.key)}
            >
              <span>{row.name}</span>
              <b>{row.status}</b>
              <small>{row.detail}</small>
              <i>{row.note}</i>
            </button>
          ))}
        </div>
      </section>

      <section className="quality-panel" aria-labelledby="quality-title">
        <h2 id="quality-title">출처 품질 점검</h2>
        <div>
          {dataQualityChips.map((chip) => (
            <button
              className={selectedKey === chip.key ? "quality-chip selected" : "quality-chip"}
              key={chip.key}
              type="button"
              aria-pressed={selectedKey === chip.key}
              onClick={() => selectSource(chip.key)}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>
      <footer className="data-disclaimer">{dataConnectionsSafetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="data-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">선택된 연결</span>
          <h2>{selected.title}</h2>
          <p>{selected.summary}</p>
        </header>
        <section>
          <h3>권한과 영향</h3>
          <dl>
            {selected.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
        </section>
        <section>
          <h3>가상 점검</h3>
          <button
            type="button"
            onClick={() => setCheckStatus(`${selected.title}: 화면용 점검 완료 · 실제 요청 0건 · 저장 없음`)}
          >
            <PlugZap size={13} /> 화면용 연결 점검
          </button>
          <p role="status">{checkStatus}</p>
        </section>
        <section className="data-limit-note">
          <h3>안전 경계</h3>
          <p>이 버튼은 실제 연결을 만들거나 네트워크 요청을 보내지 않습니다. 결과는 현재 화면 상태만 바꿉니다.</p>
        </section>
      </div>
      <footer>{dataConnectionsSafetyCopy}</footer>
    </aside>
  );

  return (
    <AppShell
      title="데이터 연결"
      accountLabel="시뮬레이션 계좌"
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
