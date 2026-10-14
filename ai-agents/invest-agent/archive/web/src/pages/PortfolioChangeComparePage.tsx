import { ArrowRight, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPortfolioChangeCompare } from "../api/portfolioChangeCompare";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatTimeOfDay } from "../lib/format";
import type { PageKey, PortfolioChangeAsset, PortfolioChangeCompareData, PortfolioChangePolicyType, Tone } from "../types/dashboard";
import "./PortfolioChangeComparePage.css";

type PortfolioChangeFilter = "all" | "up" | "down" | "check";

declare global {
  interface Window {
    __setPortfolioCompareFilterForTest?: (filter: PortfolioChangeFilter) => void;
  }
}

const filterOptions: Array<{ key: PortfolioChangeFilter; label: string }> = [
  { key: "all", label: "전체" },
  { key: "up", label: "비중 증가" },
  { key: "down", label: "비중 감소" },
  { key: "check", label: "확인 필요" }
];

const won = (value: number) => `${value < 0 ? "-" : "+"}${Math.abs(value).toLocaleString("ko-KR")}원`;
const delta = (asset: PortfolioChangeAsset) => asset.nextWeight - asset.currentWeight;
const percent = (value: number) => `${value.toFixed(1)}%`;
const point = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%p`;

function policyTone(policyType: PortfolioChangePolicyType): Tone {
  if (policyType === "pass") return "success";
  if (policyType === "block") return "danger";
  return "warning";
}

interface PortfolioChangeComparePageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function PortfolioChangeComparePage({ activePage, onNavigate }: PortfolioChangeComparePageProps) {
  const state = useFixture<PortfolioChangeCompareData>(() => getPortfolioChangeCompare(), "portfolio-change-compare");
  const [filter, setFilter] = useState<PortfolioChangeFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // See TaxFeeImpactPage for why this indirection exists: hooks must run
  // unconditionally, but the real handler needs data only available after load.
  const testHookRef = useRef<(filter: PortfolioChangeFilter) => void>(() => {});

  useEffect(() => {
    window.__setPortfolioCompareFilterForTest = (nextFilter: PortfolioChangeFilter) => testHookRef.current(nextFilter);
    return () => {
      delete window.__setPortfolioCompareFilterForTest;
    };
  }, []);

  const fallback = renderFixtureFallback(state, "변경 비교");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const portfolioChangeCompare = envelope.data;

  function visibleAssets(nextFilter: PortfolioChangeFilter) {
    return portfolioChangeCompare.assets.filter((asset) => {
      if (nextFilter === "all") return true;
      if (nextFilter === "up") return asset.direction === "up";
      if (nextFilter === "down") return asset.direction === "down";
      if (nextFilter === "check") return asset.policyType === "check";
      return false;
    });
  }

  const filteredAssets = visibleAssets(filter);
  const selected = filteredAssets.find((asset) => asset.id === selectedId) ?? filteredAssets[0] ?? null;
  const selectedDelta = selected ? delta(selected) : 0;
  const checkCount = filteredAssets.filter((asset) => asset.policyType === "check").length;
  const lastSync = formatTimeOfDay(envelope.dataAsOf);

  testHookRef.current = (nextFilter: PortfolioChangeFilter) => {
    const nextVisible = visibleAssets(nextFilter);
    setFilter(nextFilter);
    setSelectedId(nextVisible[0]?.id ?? "");
  };

  function updateFilter(nextFilter: PortfolioChangeFilter) {
    const nextVisible = visibleAssets(nextFilter);
    setFilter(nextFilter);
    if (!nextVisible.some((asset) => asset.id === selectedId)) {
      setSelectedId(nextVisible[0]?.id ?? "");
    }
  }

  const main = (
    <section className="compare-main" aria-labelledby="compare-title">
      <header className="compare-summary">
        <div>
          <span className="eyebrow">{portfolioChangeCompare.id} 승인 전 비교</span>
          <h1 id="compare-title">
            {filteredAssets.length ? `${portfolioChangeCompare.id} 자산 ${filteredAssets.length}개 변경 비교` : "선택한 조건의 자산 없음"}
          </h1>
          <p>
            {filteredAssets.length
              ? "현재 비중과 변경 후 가정 비중을 승인 전 비교로만 표시합니다."
              : "필터 조건을 바꾸면 전후 비교 항목이 다시 표시됩니다."}
          </p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="compare-kpis" aria-label="포트폴리오 비교 요약">
        <div>
          <span>현금 변화</span>
          <strong>{portfolioChangeCompare.stats.cashChange}</strong>
        </div>
        <div>
          <span>위험 변화</span>
          <strong>{portfolioChangeCompare.stats.riskChange}</strong>
        </div>
        <div>
          <span>정책 상태</span>
          <strong>확인 {checkCount}건</strong>
        </div>
        <div>
          <span>외부 연결</span>
          <strong>{envelope.externalConnections}건</strong>
        </div>
      </section>

      <section className="compare-toolbar" aria-label="전후 비교 필터">
        <div className="segments compare-filters" role="group" aria-label="비중 변화 필터">
          {filterOptions.map((option) => (
            <button
              className={filter === option.key ? "selected" : ""}
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => updateFilter(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span>기준 총액 {portfolioChangeCompare.baseAmount.toLocaleString("ko-KR")}원 · {formatDateAndMinutes(envelope.dataAsOf)} KST 화면 예시</span>
      </section>

      <section className="asset-section" aria-labelledby="asset-title">
        <div className="compare-section-head">
          <h2 id="asset-title">자산별 전/후 비중</h2>
          <span>변경 후 비중은 승인 전 비교용 가상 수치입니다.</span>
        </div>
        <div className="asset-columns" aria-hidden="true">
          <span>자산</span>
          <span>현재</span>
          <span>변경 후</span>
          <span>변화</span>
          <span>가상 금액</span>
          <span>정책</span>
        </div>
        {filteredAssets.length ? (
          <div className="asset-list" role="listbox" aria-label="포트폴리오 전후 자산 목록">
            {filteredAssets.map((asset) => {
              const isSelected = selected?.id === asset.id;
              const assetDelta = delta(asset);
              return (
                <button
                  className={isSelected ? "asset-row selected" : "asset-row"}
                  key={asset.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelectedId(asset.id)}
                >
                  <span>
                    <strong>{asset.name}</strong>
                    <small>{asset.ticker} · 화면용 예시</small>
                  </span>
                  <span>{percent(asset.currentWeight)}</span>
                  <span>{percent(asset.nextWeight)}</span>
                  <span className={assetDelta >= 0 ? "change-up" : "change-down"}>{point(assetDelta)}</span>
                  <span>{won(asset.amountChange)}</span>
                  <span>
                    <StatusPill tone={policyTone(asset.policyType)}>{asset.policyLabel}</StatusPill>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="compare-empty-state">
            <strong>선택한 조건의 자산이 없습니다.</strong>
            <span>필터를 바꾸면 첫 번째 보이는 자산과 관련 화면이 다시 설정됩니다.</span>
          </div>
        )}
      </section>

      <section className="risk-section" aria-labelledby="risk-title">
        <div className="compare-section-head">
          <h2 id="risk-title">위험·정책 변화</h2>
          <span>손실 회피나 수익 개선 보장 아님 · 화면용 예시</span>
        </div>
        <div className="risk-grid">
          <article>
            <span>예상 최대 낙폭</span>
            <strong>{portfolioChangeCompare.stats.maxDrawdownChange}</strong>
            <small>화면용 위험 예시</small>
          </article>
          <article>
            <span>반도체 합산 비중</span>
            <strong>{portfolioChangeCompare.stats.sectorConcentrationChange}</strong>
            <small>집중도 완화 예시</small>
          </article>
          <article>
            <span>승인 상태</span>
            <strong>{portfolioChangeCompare.stats.approvalState}</strong>
            <small>이 화면에서 실행 없음</small>
          </article>
        </div>
        <div className="bar-panel" aria-label="선택 자산 비중 비교">
          <div>
            <span>현재 비중</span>
            <i><b style={{ width: selected ? `${Math.min(selected.currentWeight * 2, 100)}%` : "0%" }} /></i>
            <strong>{selected ? percent(selected.currentWeight) : "미표시"}</strong>
          </div>
          <div>
            <span>변경 후 비중</span>
            <i><b style={{ width: selected ? `${Math.min(selected.nextWeight * 2, 100)}%` : "0%" }} /></i>
            <strong>{selected ? percent(selected.nextWeight) : "미표시"}</strong>
          </div>
        </div>
        <footer className="compare-disclaimer">
          변경 후 비중은 실제 체결 결과가 아니라 승인 전 비교용 가상 수치입니다. 실제 계좌·주문·체결·외부 API와 연결되어 있지 않습니다.
        </footer>
      </section>
    </section>
  );

  const inspector = (
    <aside className="compare-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 자산</span>
          <div className="decision-title">
            <div>
              <h2>{selected?.name ?? "선택 자산 없음"}</h2>
              <span>{selected ? `${portfolioChangeCompare.id} · ${selected.ticker}` : "필터 결과 없음"}</span>
            </div>
            <StatusPill tone={selected ? policyTone(selected.policyType) : "warning"}>{selected?.policyLabel ?? "빈 결과"}</StatusPill>
          </div>
          <p>{selected?.summary ?? "현재 필터에 해당하는 화면용 자산 비교가 없습니다."}</p>
        </header>

        <section className="inspector-section proposal">
          <h3>비중 변화</h3>
          <dl>
            <div><dt>현재 비중</dt><dd>{selected ? percent(selected.currentWeight) : "미표시"}</dd></div>
            <div><dt>변경 후 비중</dt><dd>{selected ? percent(selected.nextWeight) : "미표시"}</dd></div>
            <div><dt>변화폭</dt><dd>{selected ? point(selectedDelta) : "미표시"}</dd></div>
            <div><dt>기준 시각</dt><dd>{formatDateAndMinutes(envelope.dataAsOf)} KST</dd></div>
          </dl>
        </section>

        <section className="inspector-section proposal">
          <h3>가상 금액</h3>
          <p className="compare-amount-box">
            {selected
              ? `기준 총액 ${portfolioChangeCompare.baseAmount.toLocaleString("ko-KR")}원에서 ${won(selected.amountChange)} 변화로 표시한 가상 승인 전 비교입니다.`
              : "표시할 가상 금액 변화가 없습니다."}
          </p>
        </section>

        <section className="inspector-section verification">
          <h3>정책 점검</h3>
          <dl>
            <div><dt>정책 상태</dt><dd className={selected?.policyType === "pass" ? "success" : "warning"}>{selected?.policyLabel ?? "미표시"}</dd></div>
            <div><dt>정책 점검</dt><dd>{selected?.policyCheck ?? "미표시"}</dd></div>
            <div><dt>승인 상태</dt><dd>사용자 승인 대기 전 비교</dd></div>
            <div><dt>출처 상태</dt><dd>{selected?.sourceState ?? "외부 요청 0건"}</dd></div>
          </dl>
          <div className="warning">
            <b>실행 경계</b>
            <p>정책 상태는 화면 구조 검토용 예시이며 실제 주문 차단 결과가 아닙니다.</p>
          </div>
        </section>

        <section className="inspector-section verification">
          <h3>위험 점검</h3>
          <dl>
            <div><dt>예상 변동성</dt><dd>{portfolioChangeCompare.stats.riskChange}</dd></div>
            <div><dt>예상 최대 낙폭</dt><dd>{portfolioChangeCompare.stats.maxDrawdownChange}</dd></div>
            <div><dt>자산별 위험</dt><dd>{selected?.riskLabel ?? "미표시"}</dd></div>
            <div><dt>수익 개선 보장</dt><dd className="success">아님</dd></div>
          </dl>
        </section>

        <section className="inspector-section compare-boundary-box">
          <h3>실행 경계</h3>
          <p>이 화면은 주문을 생성하지 않습니다. 승인 대기 화면으로 이동해도 실제 매수·매도·체결이나 외부 요청은 발생하지 않습니다.</p>
        </section>
      </div>

      <div className="approval-panel compare-actions">
        <div className="expiry">
          <span>{portfolioChangeCompare.id} 비교는 <b>승인 대기 전</b> 상태입니다.</span>
          <small>{portfolioChangeCompare.safetyCopy}</small>
        </div>
        <button type="button" disabled={!selected} onClick={() => onNavigate("approvals")}>
          승인 대기 보기 <ArrowRight size={14} />
        </button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 로컬 fixture · {envelope.sourceLabel}</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title="변경 비교"
      accountLabel="시뮬레이션 계좌"
      lastSync={lastSync}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
