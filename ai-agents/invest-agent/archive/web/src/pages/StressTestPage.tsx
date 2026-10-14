import { useState } from "react";
import { getStressTest } from "../api/stressTest";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import type { PageKey, StressScenarioKey, StressTestData } from "../types/dashboard";
import "./StressTestPage.css";

function formatStressPercent(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

interface StressTestPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function StressTestPage({ activePage, onNavigate }: StressTestPageProps) {
  const state = useFixture<StressTestData>(() => getStressTest(), "stress-test");
  const [scenarioKey, setScenarioKey] = useState<StressScenarioKey>("rates");
  const [assetKey, setAssetKey] = useState("cash");
  const [responseIndex, setResponseIndex] = useState(0);

  const fallback = renderFixtureFallback(state, "스트레스 테스트");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const { scenarios: stressScenarios, rowsByScenario, baseAmount: stressBaseAmount, safetyCopy: stressSafetyCopy } = envelope.data;
  const scenario = stressScenarios[scenarioKey];
  const rows = rowsByScenario[scenarioKey];
  const selectedAsset = rows.find((row) => row.key === assetKey) ?? rows[0];
  const selectedResponse = scenario.responses[responseIndex] ?? scenario.responses[0];

  function selectScenario(nextScenario: StressScenarioKey) {
    setScenarioKey(nextScenario);
    setAssetKey(rowsByScenario[nextScenario][0].key);
    setResponseIndex(0);
  }

  const main = (
    <section className="stress-main" aria-labelledby="stress-title">
      <header className="stress-summary">
        <div>
          <span className="eyebrow">스트레스 테스트</span>
          <h1 id="stress-title">{scenario.label} 시나리오</h1>
          <p>{scenario.description}</p>
        </div>
        <div className="stress-metrics" aria-label="선택 시나리오 요약">
          <div><span>예상 손실</span><strong>{formatStressPercent(scenario.loss)}</strong></div>
          <div><span>최대 낙폭</span><strong>{formatStressPercent(scenario.drawdown)}</strong></div>
          <div><span>현금 방어력</span><strong>{scenario.cash}</strong></div>
          <div><span>경보</span><strong>{scenario.alerts}건</strong></div>
        </div>
      </header>
      <section className="stress-selector" aria-label="시나리오 선택">
        <div className="stress-buttons">
          {(["rates", "chips", "fx", "liquidity"] as StressScenarioKey[]).map((key) => (
            <button className={scenarioKey === key ? "selected" : ""} key={key} type="button" aria-pressed={scenarioKey === key} onClick={() => selectScenario(key)}>
              {stressScenarios[key].label}
            </button>
          ))}
        </div>
        <p>화면용 가상 충격 · 손실 회피 보장 아님</p>
      </section>
      <section className="stress-impact" aria-labelledby="stress-impact-title">
        <div className="section-head"><h2 id="stress-impact-title">자산별 충격</h2><span>기준 포트폴리오 {stressBaseAmount.toLocaleString("ko-KR")}원 · KRW 예시</span></div>
        <div className="stress-columns" aria-hidden="true"><span>자산</span><span>비중</span><span>충격률</span><span>손익 영향</span><span>상태</span></div>
        <div className="stress-list" role="listbox" aria-label="자산별 충격 결과">
          {rows.map((asset) => (
            <button className={selectedAsset.key === asset.key ? "stress-row selected" : "stress-row"} key={asset.key} type="button" role="option" aria-selected={selectedAsset.key === asset.key} onClick={() => setAssetKey(asset.key)}>
              <span><strong>{asset.name}</strong><small>{asset.ticker} · 화면용 비중</small></span>
              <span>{asset.weight.toFixed(1)}%</span>
              <span className={asset.shock < 0 ? "negative" : "stable"}>{formatStressPercent(asset.shock)}</span>
              <span className={asset.contribution < 0 ? "negative" : "stable"}>{asset.contribution.toFixed(2)}%p</span>
              <span className="impact-state">{asset.state}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="stress-response" aria-labelledby="stress-response-title">
        <div className="section-head"><h2 id="stress-response-title">대응 후보</h2><span>{scenario.responses.length}건 · 실행 없음</span></div>
        <div className="stress-response-list">
          {scenario.responses.map((response, index) => (
            <button className={responseIndex === index ? "response-card selected" : "response-card"} key={response} type="button" aria-pressed={responseIndex === index} onClick={() => setResponseIndex(index)}>
              <strong>{response}</strong><span>{scenario.label} 대응 후보</span><small>실행이 아닌 화면용 검토 항목입니다. 사용자 승인 전 어떤 주문도 생성하지 않습니다.</small>
            </button>
          ))}
        </div>
      </section>
      <footer className="stress-disclaimer">{stressSafetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="stress-inspector" aria-live="polite" aria-atomic="false">
      <div className="stress-inspector-scroll">
        <header>
          <span className="eyebrow">선택 상세</span>
          <div className="stress-inspector-title"><h2>{scenario.label} · {selectedAsset.name}</h2><span>가상 점검</span></div>
          <p>{selectedAsset.name}의 화면용 충격률은 {formatStressPercent(selectedAsset.shock)}이며 대응 후보는 '{selectedResponse}'입니다.</p>
        </header>
        <section>
          <h3>충격 가정</h3>
          <dl><div><dt>시나리오</dt><dd>{scenario.label}</dd></div><div><dt>충격 가정</dt><dd>{scenario.assumption}</dd></div><div><dt>예상 손실</dt><dd>{formatStressPercent(scenario.loss)}</dd></div><div><dt>경보 수</dt><dd>{scenario.alerts}건</dd></div></dl>
        </section>
        <section>
          <h3>취약 지점</h3>
          <dl><div><dt>선택 자산</dt><dd>{selectedAsset.name}</dd></div><div><dt>포트폴리오 비중</dt><dd>{selectedAsset.weight.toFixed(1)}%</dd></div><div><dt>충격률</dt><dd>{formatStressPercent(selectedAsset.shock)}</dd></div><div><dt>손익 영향</dt><dd>{selectedAsset.contribution.toFixed(2)}%p</dd></div></dl>
          <div className="stress-risk-note">손익 영향 = 비중 × 충격률 ÷ 100. 취약도는 고정 배열 비교이며 실제 위험 예측이 아닙니다.</div>
        </section>
        <section>
          <h3>정책·데이터 경계</h3>
          <dl><div><dt>정책 경계</dt><dd>{scenario.policy}</dd></div><div><dt>주요 취약</dt><dd>{scenario.weak}</dd></div><div><dt>데이터 상태</dt><dd>고정 예시·미연결</dd></div><div><dt>외부 요청</dt><dd>0건</dd></div></dl>
        </section>
        <section className="approval-boundary">
          <h3>실행 경계</h3>
          <p>대응 후보는 사용자 승인 전 실행할 수 없고, 이 화면은 실제 주문을 만들지 않습니다.</p>
          <button type="button" onClick={() => onNavigate("approvals")}>승인 대기 화면 보기<span>›</span></button>
        </section>
        <nav className="stress-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          <button type="button" onClick={() => onNavigate("rebalance")}>전략 조정 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("risks")}>리스크 알림 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("data")}>데이터 연결 보기<span>›</span></button>
        </nav>
      </div>
      <footer>{stressSafetyCopy}</footer>
    </aside>
  );

  return <AppShell title="스트레스 테스트" accountLabel="시뮬레이션 계좌" lastSync="화면용" activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}
