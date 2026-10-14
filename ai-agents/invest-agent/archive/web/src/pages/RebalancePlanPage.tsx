import { useState } from "react";
import { getRebalancePlan } from "../api/rebalancePlan";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import type { PageKey, RebalancePlanData, RebalanceProposal, RebalanceStrategyKey } from "../types/dashboard";
import "./RebalancePlanPage.css";

function signedPoint(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%p`;
}

interface RebalancePlanPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function RebalancePlanPage({ activePage, onNavigate }: RebalancePlanPageProps) {
  const state = useFixture<RebalancePlanData>(() => getRebalancePlan(), "rebalance-plan");
  const [strategy, setStrategy] = useState<RebalanceStrategyKey>("balanced");
  const [selectedKey, setSelectedKey] = useState("cash");

  const fallback = renderFixtureFallback(state, "전략 조정");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const { currentAllocations, strategies: rebalanceStrategies, proposalsByStrategy, baseAmount: rebalanceBaseAmount, safetyCopy: rebalanceSafetyCopy } = envelope.data;
  const plan = rebalanceStrategies[strategy];
  const proposals = proposalsByStrategy[strategy];
  const selected = proposals.find((proposal) => proposal.key === selectedKey) ?? proposals[0];

  function updateStrategy(nextStrategy: RebalanceStrategyKey) {
    const nextProposals = proposalsByStrategy[nextStrategy];
    setStrategy(nextStrategy);
    setSelectedKey(nextProposals[0]?.key ?? "");
  }

  const main = (
    <section className="rebalance-main" aria-labelledby="rebalance-title">
      <header className="strategy-summary">
        <div>
          <span className="eyebrow">전략 비교</span>
          <h1 id="rebalance-title">{plan.label} 목표안</h1>
          <p>현재 비중과 화면용 목표 비중의 차이만 비교합니다.</p>
        </div>
        <div className="summary-metrics" aria-label="선택 전략 예상 요약">
          <div><span>예상 수익</span><strong>{plan.expectedReturn}</strong></div>
          <div><span>예상 변동성</span><strong>{plan.volatility}</strong></div>
          <div><span>예상 최대 낙폭</span><strong>{plan.drawdown}</strong></div>
          <div><span>현금 목표</span><strong>{plan.targets.cash.toFixed(1)}%</strong></div>
        </div>
      </header>

      <section className="strategy-selector" aria-label="전략 선택">
        <div>
          <span>목표 전략</span>
          <div className="segments" role="group" aria-label="목표 전략">
            {(["conservative", "balanced", "aggressive"] as RebalanceStrategyKey[]).map((value) => (
              <button className={strategy === value ? "selected" : ""} key={value} type="button" aria-pressed={strategy === value} onClick={() => updateStrategy(value)}>
                {rebalanceStrategies[value].label}
              </button>
            ))}
          </div>
        </div>
        <p>사용자 승인 전 실행 불가 · 실제 주문 아님</p>
      </section>

      <section className="allocation-section" aria-labelledby="allocation-title">
        <div className="section-head"><h2 id="allocation-title">현재·목표 비중 비교</h2><span>합계 100.0% · KRW 화면 예시</span></div>
        <div className="allocation-list">
          {currentAllocations.map((asset) => {
            const target = plan.targets[asset.key];
            const delta = target - asset.weight;
            return (
              <article className="allocation-card" key={asset.key}>
                <strong>{asset.name}</strong>
                <small>{asset.ticker} · 가상 잔고</small>
                <div className="weight-pair">
                  <div><span>현재</span><b>{asset.weight.toFixed(1)}%</b></div>
                  <div><span>목표</span><b>{target.toFixed(1)}%</b></div>
                </div>
                <div className="weight-track"><i style={{ width: `${target}%` }} /></div>
                <em className={delta > 0 ? "up" : delta < 0 ? "down" : ""}>{signedPoint(delta)}</em>
              </article>
            );
          })}
        </div>
      </section>

      <section className="proposal-section" aria-labelledby="proposal-title">
        <div className="section-head"><h2 id="proposal-title">화면용 리밸런싱 제안</h2><span>{proposals.length}건 · 실제 주문 생성 없음</span></div>
        <div className="proposal-columns" aria-hidden="true"><span>자산</span><span>방향</span><span>비중 변화</span><span>예상 금액</span><span>정책 상태</span></div>
        <div className="proposal-list" role="listbox" aria-label="리밸런싱 제안 목록">
          {proposals.map((proposal) => <ProposalRow key={proposal.key} proposal={proposal} selected={proposal.key === selected.key} onSelect={setSelectedKey} />)}
        </div>
      </section>
      <footer className="rebalance-disclaimer">{rebalanceSafetyCopy}</footer>
    </section>
  );

  const inspector = (
    <aside className="rebalance-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span className="eyebrow">선택 제안</span>
          <div className="rebalance-inspector-title">
            <h2>{selected.name} · {selected.direction}</h2>
            <span>가상 제안</span>
          </div>
          <p>{selected.effect}</p>
        </header>
        <section>
          <h3>예상 효과</h3>
          <dl>
            <div><dt>현재 비중</dt><dd>{selected.weight.toFixed(1)}%</dd></div>
            <div><dt>목표 비중</dt><dd>{selected.target.toFixed(1)}%</dd></div>
            <div><dt>비중 변화</dt><dd>{signedPoint(selected.delta)}</dd></div>
            <div><dt>계산식</dt><dd>|비중 변화| ÷ 100 × 기준 금액</dd></div>
            <div><dt>예상 금액</dt><dd>{selected.amount}</dd></div>
          </dl>
        </section>
        <section>
          <h3>정책 점검</h3>
          <dl>
            <div><dt>전략</dt><dd>{plan.label}</dd></div>
            <div><dt>종목 한도</dt><dd>{selected.policy}</dd></div>
            <div><dt>최소 현금</dt><dd>{plan.targets.cash >= 15 ? "충족 예시" : "미달 경고"}</dd></div>
            <div><dt>승인 상태</dt><dd>사용자 확인 전</dd></div>
          </dl>
          <div className="policy-note">정책 비교 결과도 고정 예시이며 실제 주문 가능 판정이 아닙니다.</div>
        </section>
        <section>
          <h3>리스크·출처 상태</h3>
          <dl>
            <div><dt>예상 변동성</dt><dd>{plan.volatility}</dd></div>
            <div><dt>예상 최대 낙폭</dt><dd>{plan.drawdown}</dd></div>
            <div><dt>출처 상태</dt><dd>{selected.source}</dd></div>
            <div><dt>외부 요청</dt><dd>0건</dd></div>
          </dl>
        </section>
        <section className="approval-boundary">
          <h3>실행 경계</h3>
          <p>사용자 승인 전 실행할 수 없으며 승인 후에도 실제 주문은 생성되지 않습니다. 기준 금액은 {rebalanceBaseAmount.toLocaleString("ko-KR")}원 가상 잔고입니다.</p>
          <button type="button" onClick={() => onNavigate("approvals")}>승인 대기 화면 보기<span>›</span></button>
        </section>
        <nav className="rebalance-related-links" aria-label="관련 화면">
          <h3>관련 화면</h3>
          <button type="button" onClick={() => onNavigate("backtest")}>백테스트 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("policy")}>투자 정책 보기<span>›</span></button>
          <button type="button" onClick={() => onNavigate("risks")}>리스크 알림 보기<span>›</span></button>
        </nav>
      </div>
      <footer>{rebalanceSafetyCopy}</footer>
    </aside>
  );

  return <AppShell title="전략 조정" accountLabel="시뮬레이션 계좌" lastSync="화면용" activePage={activePage} onNavigate={onNavigate} main={main} inspector={inspector} />;
}

function ProposalRow({ proposal, selected, onSelect }: { proposal: RebalanceProposal; selected: boolean; onSelect: (key: string) => void }) {
  return (
    <button className={selected ? "proposal-row selected" : "proposal-row"} type="button" role="option" aria-selected={selected} onClick={() => onSelect(proposal.key)}>
      <span><strong>{proposal.name}</strong><small>{proposal.ticker} · 화면용</small></span>
      <span className={proposal.delta > 0 ? "buy" : "sell"}>{proposal.delta > 0 ? "확대" : "축소"}</span>
      <span>{signedPoint(proposal.delta)}</span>
      <span>{proposal.amount}</span>
      <span className="policy-state">{proposal.policy}</span>
    </button>
  );
}
