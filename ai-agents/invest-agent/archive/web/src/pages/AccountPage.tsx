import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { getAccount } from "../api/account";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import {
  formatDateAndMinutes,
  formatPercent,
  formatSignedPercent,
  formatSignedWon,
  formatTimeOfDay,
  formatWon
} from "../lib/format";
import type { AccountData, PageKey } from "../types/dashboard";
import "./AccountPage.css";

interface AccountPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function AccountPage({ activePage, onNavigate }: AccountPageProps) {
  const state = useFixture<AccountData>(() => getAccount(), "account");
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "계좌");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const account = envelope.data;
  const { summary } = account;
  const accumulatedProfit = summary.totalAsset - summary.principal;
  const selected =
    account.assetClasses.find((row) => row.label === selectedLabel) ?? account.assetClasses[0];

  const main = (
    <section className="account-main" aria-labelledby="account-title">
      <header className="account-summary">
        <div>
          <span className="eyebrow">{account.accountKind}</span>
          <h1 id="account-title">{formatWon(summary.totalAsset)}</h1>
          <p className="account-metrics">
            <span>투자금액 <b>{formatWon(summary.investedAmount)}</b></span>
            <i />
            <span>현금 <b>{formatWon(summary.cashAmount)}</b></span>
            <i />
            <span>누적손익 <b className={accumulatedProfit < 0 ? "loss" : "gain"}>{formatSignedWon(accumulatedProfit)}</b></span>
          </p>
          <p className="account-timestamps">
            기준 시각 {formatDateAndMinutes(envelope.dataAsOf)} <span>·</span> 마지막 검증{" "}
            {formatTimeOfDay(summary.lastVerifiedAt)}
          </p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="account-kpis" aria-label="계좌 손익 요약">
        <div><span>투자원금</span><strong>{formatWon(summary.principal)}</strong></div>
        <div><span>실현손익</span><strong className="gain">{formatSignedWon(summary.realizedProfit)}</strong></div>
        <div><span>미실현손익</span><strong className="gain">{formatSignedWon(summary.unrealizedProfit)}</strong></div>
        <div><span>실행된 주문</span><strong>{envelope.executed ? "있음" : "없음"}</strong></div>
      </section>

      <div className="account-columns">
        <section className="account-block" aria-labelledby="asset-class-title">
          <div className="account-section-head">
            <h2 id="asset-class-title">자산군 배분</h2>
            <span>행을 선택하면 우측에 상세가 표시됩니다.</span>
          </div>
          <div className="account-list" role="listbox" aria-label="자산군 목록">
            {account.assetClasses.map((row) => {
              const isSelected = selected?.label === row.label;
              return (
                <button
                  className={isSelected ? "account-row selected" : "account-row"}
                  key={row.label}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => setSelectedLabel(row.label)}
                >
                  <span className="account-row-name">
                    <strong>{row.label}</strong>
                    <small>{row.note}</small>
                  </span>
                  <span className="account-bar" aria-hidden="true">
                    <i style={{ width: `${row.weight}%` }} className={`tone-${row.tone}`} />
                  </span>
                  <span className="account-row-value">
                    <strong>{formatWon(row.value)}</strong>
                    <small>{formatPercent(row.weight)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="account-block" aria-labelledby="currency-title">
          <div className="account-section-head">
            <h2 id="currency-title">통화 노출</h2>
            <span>실제 환율 미연결 · 기초자산 기준 추정</span>
          </div>
          <table className="account-table">
            <thead>
              <tr><th>통화</th><th>금액</th><th>비중</th><th>설명</th></tr>
            </thead>
            <tbody>
              {account.currencies.map((row) => (
                <tr key={row.code}>
                  <td><strong>{row.code}</strong><small>{row.label}</small></td>
                  <td>{formatWon(row.value)}</td>
                  <td>{formatPercent(row.weight)}</td>
                  <td className="account-note">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="account-block returns" aria-labelledby="returns-title">
        <div className="account-section-head">
          <h2 id="returns-title">기간별 수익률</h2>
          <span>입출금 영향을 제외한 값을 함께 표시합니다.</span>
        </div>
        <table className="account-table">
          <thead>
            <tr><th>기간</th><th>손익</th><th>수익률</th><th>입출금 제외</th><th>벤치마크</th></tr>
          </thead>
          <tbody>
            {account.returns.map((row) => (
              <tr key={row.period}>
                <td><strong>{row.period}</strong></td>
                <td className={row.profit < 0 ? "loss" : "gain"}>{formatSignedWon(row.profit)}</td>
                <td className={row.profitRate < 0 ? "loss" : "gain"}>{formatSignedPercent(row.profitRate)}</td>
                <td>{formatSignedPercent(row.netInvestmentRate)}</td>
                <td className="account-note">{formatSignedPercent(row.benchmarkRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="account-disclaimer">
        {account.safetyCopy}
      </footer>
    </section>
  );

  const inspector = (
    <aside className="account-inspector" aria-label="계좌 상세" aria-live="polite">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 자산군</span>
          <div className="decision-title">
            <div>
              <h2>{selected?.label ?? "선택 없음"}</h2>
              <span>{account.accountLabel}</span>
            </div>
            <StatusPill tone={selected?.tone ?? "neutral"}>
              {selected ? formatPercent(selected.weight) : "0.00%"}
            </StatusPill>
          </div>
          <p>{selected?.note ?? "표시할 자산군이 없습니다."}</p>
        </header>

        <section className="inspector-section proposal">
          <h3>자산군 요약</h3>
          <dl>
            <div><dt>평가금액</dt><dd>{selected ? formatWon(selected.value) : "미표시"}</dd></div>
            <div><dt>비중</dt><dd>{selected ? formatPercent(selected.weight) : "미표시"}</dd></div>
            <div><dt>기준 통화</dt><dd>{account.currency}</dd></div>
            <div><dt>기준 시각</dt><dd>{formatDateAndMinutes(envelope.dataAsOf)}</dd></div>
          </dl>
        </section>

        <section className="inspector-section proposal">
          <h3>원금 구성</h3>
          <dl>
            <div><dt>누적 입금</dt><dd>{formatWon(summary.depositTotal)}</dd></div>
            <div><dt>누적 출금</dt><dd>{formatWon(summary.withdrawalTotal)}</dd></div>
            <div><dt>투자원금</dt><dd>{formatWon(summary.principal)}</dd></div>
          </dl>
          <div className="warning">
            <b>수익률 주의</b>
            <p>입금은 수익이 아닙니다. 잔고 증가분을 그대로 성과로 읽지 않도록 입출금 제외 수익률을 함께 봅니다.</p>
          </div>
        </section>

        <section className="inspector-section verification">
          <h3>입출금 이력</h3>
          <ul className="account-flow-list">
            {account.cashFlows.map((row) => (
              <li key={row.id}>
                <span className={row.kind === "입금" ? "flow-in" : "flow-out"}>{row.kind}</span>
                <strong>{formatWon(row.amount)}</strong>
                <small>{formatDateAndMinutes(row.occurredAt)}</small>
                <p>{row.memo}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="inspector-section boundary-box">
          <h3>데이터·실행 경계</h3>
          <p>{account.safetyCopy}</p>
        </section>
      </div>

      <div className="approval-panel account-actions">
        <div className="expiry">
          <span>이 계좌는 시뮬레이션 상태이며 잔고 조회, 이체, 환전 요청을 만들지 않습니다.</span>
          <small>실제 증권사 계좌·입출금 아님</small>
        </div>
        <button type="button" onClick={() => onNavigate("dashboard")}>보유 종목 보기</button>
        <p><ShieldAlert size={12} aria-hidden="true" /> 로컬 fixture · 외부 요청 {envelope.externalConnections}건</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title={account.title}
      accountLabel={account.accountLabel}
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
