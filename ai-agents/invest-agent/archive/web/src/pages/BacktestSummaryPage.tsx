import { useState } from "react";
import { getBacktestSummary } from "../api/backtestSummary";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import type { BacktestPeriodKey, BacktestRow, BacktestStrategyKey, BacktestSummaryData, PageKey } from "../types/dashboard";
import "./BacktestSummaryPage.css";

function signedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

interface BacktestSummaryPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function BacktestSummaryPage({ activePage, onNavigate }: BacktestSummaryPageProps) {
  const state = useFixture<BacktestSummaryData>(() => getBacktestSummary(), "backtest-summary");
  const [period, setPeriod] = useState<BacktestPeriodKey>("6m");
  const [strategy, setStrategy] = useState<BacktestStrategyKey>("balanced");
  const [selectedMonth, setSelectedMonth] = useState("2026.04");

  const fallback = renderFixtureFallback(state, "백테스트");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const { configs: backtestConfigs, periods: backtestPeriods, metrics: metricsBySelection, rows: rowsBySelection, safetyCopy: backtestSafetyCopy } = envelope.data;
  const config = backtestConfigs[strategy];
  const term = backtestPeriods[period];
  const metrics = metricsBySelection[strategy][period];
  const rows = rowsBySelection[strategy][period];
  const selected = rows.find((row) => row.month === selectedMonth) ?? rows[0];

  function updatePeriod(nextPeriod: BacktestPeriodKey) {
    const nextRows = rowsBySelection[strategy][nextPeriod];
    setPeriod(nextPeriod);
    setSelectedMonth(nextRows[0]?.month ?? "");
  }

  function updateStrategy(nextStrategy: BacktestStrategyKey) {
    const nextRows = rowsBySelection[nextStrategy][period];
    setStrategy(nextStrategy);
    setSelectedMonth(nextRows[0]?.month ?? "");
  }

  const main = (
    <section className="backtest-main" aria-labelledby="backtest-title">
      <header className="backtest-summary">
        <div className="summary-heading">
          <span className="eyebrow">전략 검증</span>
          <h1 id="backtest-title">{config.label} · {term.label}</h1>
          <p>나중에 결정론적 Python 계산으로 옮길 화면 구조 예시입니다.</p>
        </div>
        <div className="metric-grid" aria-label="백테스트 요약 지표">
          <div><span>검증 기간</span><strong>{term.range}</strong></div>
          <div><span>포트폴리오</span><strong>{signedPercent(metrics.ret)}</strong></div>
          <div><span>벤치마크</span><strong>{signedPercent(metrics.bench)}</strong></div>
          <div><span>최대 낙폭</span><strong>{signedPercent(metrics.dd)}</strong></div>
          <div><span>변동성</span><strong>{metrics.vol.toFixed(1)}%</strong></div>
          <div><span>승률</span><strong>{metrics.win}%</strong></div>
        </div>
      </header>

      <section className="backtest-filters" aria-label="백테스트 조건">
        <div>
          <span>기간</span>
          <div className="segments" role="group" aria-label="기간">
            {(["3m", "6m", "1y"] as BacktestPeriodKey[]).map((value) => (
              <button className={period === value ? "selected" : ""} key={value} type="button" aria-pressed={period === value} onClick={() => updatePeriod(value)}>
                {backtestPeriods[value].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span>전략</span>
          <div className="segments" role="group" aria-label="전략">
            {(["conservative", "balanced", "aggressive"] as BacktestStrategyKey[]).map((value) => (
              <button className={strategy === value ? "selected" : ""} key={value} type="button" aria-pressed={strategy === value} onClick={() => updateStrategy(value)}>
                {backtestConfigs[value].label}
              </button>
            ))}
          </div>
        </div>
        <span className="basis-time">고정 예시 생성 2026.08.26 16:00 KST</span>
      </section>

      <section className="result-section" aria-labelledby="result-title">
        <div className="result-head"><h2 id="result-title">월별 검증 결과</h2><span>월말 평가금액 기준 단순 수익률</span></div>
        <div className="result-columns" aria-hidden="true"><span>구간</span><span>포트폴리오</span><span>벤치마크</span><span>초과수익</span><span>낙폭</span><span>결과</span></div>
        <div className="result-list" role="listbox" aria-label="월별 백테스트 결과">
          {rows.map((row) => <BacktestResultRow key={row.month} row={row} selected={row.month === selected.month} onSelect={setSelectedMonth} />)}
        </div>
      </section>

      <section className="limitations" aria-labelledby="limits-title">
        <h2 id="limits-title">검증 한계</h2>
        <div><strong>미래정보 사용 금지</strong><span>신호 시점 이후 데이터만 사용한다는 점검 예시</span></div>
        <div><strong>편향 점검 필요</strong><span>생존편향·선택편향을 제거한 실제 검증이 아님</span></div>
        <div><strong>과최적화 경고</strong><span>전략·기간 선택 결과를 일반화할 수 없음</span></div>
      </section>
      <footer className="backtest-disclaimer">{backtestSafetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="backtest-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">선택 결과</span>
          <div className="backtest-inspector-title">
            <h2>{config.label} · {selected.month}</h2>
            <span>가상 계산</span>
          </div>
          <p>{term.label} 화면용 검증 중 선택 월 결과입니다. 실제 과거 시세 계산이 아닙니다.</p>
        </header>
        <section>
          <h3>계산식과 비용 가정</h3>
          <dl>
            <div><dt>월 수익률</dt><dd>(월말-월초)÷월초</dd></div>
            <div><dt>선택 월</dt><dd>{signedPercent(selected.portfolio)}</dd></div>
            <div><dt>수수료</dt><dd>매매금액 0.015% 가정</dd></div>
            <div><dt>세금·슬리피지</dt><dd>0.18%·0.10% 가정</dd></div>
          </dl>
          <div className="cost-note">수수료·세금·슬리피지는 단순 가정이며 실제 정산값이 아닙니다.</div>
        </section>
        <section>
          <h3>위험 지표</h3>
          <dl>
            <div><dt>최대 낙폭</dt><dd>{signedPercent(metrics.dd)}</dd></div>
            <div><dt>선택 월 낙폭</dt><dd>{signedPercent(selected.drawdown)}</dd></div>
            <div><dt>연환산 변동성</dt><dd>{metrics.vol.toFixed(1)}%</dd></div>
            <div><dt>데이터</dt><dd>고정 배열·KRW 예시</dd></div>
          </dl>
        </section>
        <section>
          <h3>데이터·편향 점검</h3>
          <ul className="bias-list">
            <li><b>미래정보</b><span>사용 금지 점검 예시</span></li>
            <li><b>생존편향</b><span>미검증</span></li>
            <li><b>선택편향</b><span>미검증</span></li>
            <li><b>과최적화</b><span>경고</span></li>
          </ul>
        </section>
        <nav className="backtest-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          <button type="button" onClick={() => onNavigate("policy")}>투자 정책 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("risks")}>리스크 알림 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("trades")}>모의 거래 내역 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("data")}>데이터 연결 보기<span>›</span></button>
        </nav>
      </div>
      <footer>{backtestSafetyCopy}</footer>
    </aside>
  );

  return <AppShell title="백테스트" accountLabel="시뮬레이션 계좌" lastSync="16:00" activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}

function BacktestResultRow({ row, selected, onSelect }: { row: BacktestRow; selected: boolean; onSelect: (month: string) => void }) {
  return (
    <button className={selected ? "result-row selected" : "result-row"} type="button" role="option" aria-selected={selected} onClick={() => onSelect(row.month)}>
      <span><strong>{row.month}</strong><small>월말 고정 예시</small></span>
      <span className={row.portfolio >= 0 ? "positive" : "negative"}>{signedPercent(row.portfolio)}</span>
      <span>{signedPercent(row.benchmark)}</span>
      <span className={row.excess >= 0 ? "positive" : "negative"}>{signedPercent(row.excess)}</span>
      <span className="negative">{signedPercent(row.drawdown)}</span>
      <span className="result-state">{row.state}</span>
    </button>
  );
}
