import { ArrowRight, ShieldAlert } from "lucide-react";
import { getEvidencePackets } from "../api/evidencePackets";
import { AppShell } from "../components/AppShell";
import { DataBoundaryNotice } from "../components/DataBoundaryNotice";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { StatusPill } from "../components/StatusPill";
import { useFixture } from "../lib/useFixture";
import { formatPercent, formatTimeOfDay, formatWon } from "../lib/format";
import type { EvidencePacketsData, PageKey, Tone } from "../types/dashboard";
import "./EvidencePacketPage.css";

interface EvidencePacketPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

function toneClass(tone: Tone) {
  return `evidence-packet-card ${tone}`;
}

export function EvidencePacketPage({ activePage, onNavigate }: EvidencePacketPageProps) {
  const state = useFixture<EvidencePacketsData>(() => getEvidencePackets(), "evidence-packets");

  const fallback = renderFixtureFallback(state, "근거 패킷");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const packet = envelope.data.packets[0];
  const lastSync = formatTimeOfDay(envelope.dataAsOf);
  const displayStatus =
    packet.decisionStatus === "approved" ? "모의승인됨" : packet.decisionStatus === "rejected" ? "반려됨" : packet.status;
  const displayTone: Tone = packet.decisionStatus === "pending" ? packet.statusTone : "info";

  const main = (
    <section className="evidence-main" aria-labelledby="evidence-title">
      <header className="evidence-summary">
        <div>
          <span className="eyebrow">승인 전 근거 패킷</span>
          <h1 id="evidence-title">{packet.id} · {displayStatus}</h1>
          <p>{packet.summary}</p>
        </div>
        <DataBoundaryNotice />
      </header>

      <section className="evidence-kpis" aria-label="근거 패킷 요약">
        <div>
          <span>표시 결정</span>
          <strong>{packet.id}</strong>
        </div>
        <div>
          <span>근거 항목</span>
          <strong>{packet.items.length}개</strong>
        </div>
        <div>
          <span>외부 연결</span>
          <strong>{envelope.externalConnections}건</strong>
        </div>
        <div>
          <span>실행 상태</span>
          <strong>{envelope.executed ? "실행됨" : "실행 안 됨"}</strong>
        </div>
      </section>

      <section className="decision-card" aria-labelledby="decision-card-title">
        <div>
          <span className="eyebrow">결정 후보</span>
          <h2 id="decision-card-title">{packet.company} {packet.quantity}주 지정가 매수</h2>
          <p>{packet.code} · {packet.proposal}</p>
        </div>
        <StatusPill tone={displayTone}>{displayStatus}</StatusPill>
        <dl>
          <div><dt>지정가</dt><dd>{formatWon(packet.price)}</dd></div>
          <div><dt>최대 금액</dt><dd>{formatWon(packet.amount)}</dd></div>
          <div><dt>목표 비중</dt><dd>{formatPercent(packet.targetWeightFrom)} → {formatPercent(packet.targetWeightTo)}</dd></div>
          <div><dt>만료</dt><dd>{formatTimeOfDay(packet.expiresAt)}</dd></div>
        </dl>
      </section>

      <section className="packet-grid" aria-labelledby="packet-grid-title">
        <div className="section-head">
          <h2 id="packet-grid-title">근거 항목</h2>
          <span>계산, 정책, 비용, 출처, 리스크, 역할, 승인 경계</span>
        </div>
        <div className="evidence-card-grid">
          {packet.items.map((item) => (
            <article className={toneClass(item.tone)} key={item.title}>
              <div>
                <b>{item.title}</b>
                <StatusPill tone={item.tone}>{item.status}</StatusPill>
              </div>
              <strong>{item.summary}</strong>
              <p>{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="evidence-footer">
        <ShieldAlert size={14} aria-hidden="true" />
        <span>{packet.safetyCopy}</span>
      </footer>
    </section>
  );

  const inspector = (
    <aside className="evidence-inspector" aria-label="선택된 근거 패킷 상세">
      <div className="inspector-scroll">
        <header className="inspector-header">
          <span className="eyebrow">선택 근거 패킷</span>
          <div className="decision-title">
            <div>
              <h2>{packet.company}</h2>
              <span>{packet.id} · {packet.code}</span>
            </div>
            <StatusPill tone={displayTone}>{displayStatus}</StatusPill>
          </div>
        </header>

        <section className="inspector-section proposal">
          <h3>계산 재현성</h3>
          <strong>{packet.calculation.formula} = {packet.calculation.result}</strong>
          <dl>
            <div><dt>수량</dt><dd>{packet.quantity}주</dd></div>
            <div><dt>지정가</dt><dd>{formatWon(packet.price)}</dd></div>
            <div><dt>반올림</dt><dd>{packet.calculation.rounding}</dd></div>
          </dl>
        </section>

        <section className="inspector-section verification">
          <h3>정책·비용</h3>
          <dl>
            <div><dt>정책 한도</dt><dd className="warning">조건부 예시</dd></div>
            <div><dt>수수료</dt><dd>{packet.cost.fee}</dd></div>
            <div><dt>세금</dt><dd>{packet.cost.tax}</dd></div>
            <div><dt>슬리피지</dt><dd>{packet.cost.slippage}</dd></div>
          </dl>
        </section>

        <section className="inspector-section verification">
          <h3>출처 상태·리스크</h3>
          <dl>
            <div><dt>출처</dt><dd className="warning">{packet.sourceState}</dd></div>
            <div><dt>집중도</dt><dd>{packet.risk.concentration}</dd></div>
            <div><dt>변동성</dt><dd className="warning">{packet.risk.volatility}</dd></div>
          </dl>
          <div className="warning">
            <b>판단 무효 조건</b>
            <p>{packet.risk.invalidCondition}</p>
          </div>
        </section>

        <section className="inspector-section evidence-roles">
          <h3>역할 확인</h3>
          <dl>
            {packet.roles.map((role) => (
              <div key={role.role}>
                <dt>{role.role}</dt>
                <dd className={role.tone}>{role.check}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="inspector-section boundary-box">
          <h3>사용자 승인 경계</h3>
          <p>{packet.approvalBoundary}</p>
        </section>
      </div>

      <div className="approval-panel evidence-actions">
        <div className="expiry">
          <span>이 패킷은 <b>{formatTimeOfDay(packet.expiresAt)}</b>까지 승인 대기와 연결됩니다.</span>
          <small>{packet.safetyCopy}</small>
        </div>
        <button type="button" onClick={() => onNavigate("approvals")}>
          승인 대기 보기 <ArrowRight size={14} />
        </button>
        <p>모의투자 · 로컬 fixture 기반 화면</p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title="근거 패킷"
      accountLabel="시뮬레이션 계좌"
      lastSync={lastSync}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
