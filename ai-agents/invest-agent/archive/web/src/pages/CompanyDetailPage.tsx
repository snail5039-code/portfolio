import { ArrowLeft, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { getCompanyDetail } from "../api/companyDetail";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatDateAndMinutes, formatPercent, formatShares, formatSignedPercent, formatSignedWon, formatTimeOfDay, formatWon } from "../lib/format";
import type { CompanyDetailData, CompanyEvidenceItem, PageKey } from "../types/dashboard";
import "./CompanyDetailPage.css";

interface CompanyDetailPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function CompanyDetailPage({ activePage, onNavigate }: CompanyDetailPageProps) {
  const state = useFixture<CompanyDetailData>(() => getCompanyDetail(), "company-detail");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "기업 상세");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const companyDetail = envelope.data;
  const allItems: CompanyEvidenceItem[] = [...companyDetail.evidence, ...companyDetail.filings];
  const selected = allItems.find((item) => item.id === selectedId) ?? companyDetail.evidence[0];
  const points = companyDetail.chart.map((point, index) => `${22 + index * 40},${point.y}`).join(" ");

  function selectEvidence(item: CompanyEvidenceItem) {
    setSelectedId(item.id);
  }

  const main = (
    <article className="company-main" aria-labelledby="company-title">
      <header className="company-header">
        <div>
          <button className="inline-link" type="button" onClick={() => onNavigate("dashboard")}>
            <ArrowLeft size={13} /> 포트폴리오
          </button>
          <div className="company-title">
            <h1 id="company-title">{companyDetail.company}</h1>
            <span>{companyDetail.code}</span>
            <span>{companyDetail.market}</span>
            <span>{companyDetail.sector}</span>
          </div>
          <p>{companyDetail.safetyCopy}</p>
        </div>
        <time>{formatDateAndMinutes(envelope.dataAsOf)} KST 기준</time>
      </header>

      <section className="price-holding" aria-labelledby="price-title">
        <div className="price-summary">
          <span id="price-title">현재가</span>
          <strong>{formatWon(companyDetail.price.currentPrice)}</strong>
          <small className="gain">{formatSignedWon(companyDetail.price.changeAmount)} · {formatSignedPercent(companyDetail.price.changeRatePercent)} 예시</small>
          <dl>
            <div><dt>보유</dt><dd>{formatShares(companyDetail.price.quantity)}</dd></div>
            <div><dt>평균단가</dt><dd>{formatWon(companyDetail.price.averagePrice)}</dd></div>
            <div><dt>평가액</dt><dd>{formatWon(companyDetail.price.value)}</dd></div>
            <div><dt>손익</dt><dd className="gain">{formatSignedWon(companyDetail.price.profit)} · {formatSignedPercent(companyDetail.price.profitRate)}</dd></div>
            <div><dt>비중</dt><dd>{formatPercent(companyDetail.price.weight)}</dd></div>
          </dl>
        </div>
        <div className="mini-chart">
          <p className="chart-alt">최근 12개 화면 예시 가격: {formatWon(companyDetail.chart[0].price)}에서 {formatWon(companyDetail.chart[companyDetail.chart.length - 1].price)}으로 변화</p>
          <svg viewBox="0 0 480 126" role="img" aria-label="삼성전자 최근 12개 예시 가격 선 차트">
            <g className="detail-grid">
              <line x1="20" y1="20" x2="466" y2="20" />
              <line x1="20" y1="62" x2="466" y2="62" />
              <line x1="20" y1="104" x2="466" y2="104" />
            </g>
            <polyline points={points} />
            <g className="chart-points">
              {companyDetail.chart.map((point, index) => (
                <circle key={point.index} cx={22 + index * 40} cy={point.y} r="4">
                  <title>{point.index}번째 예시 · {formatWon(point.price)}</title>
                </circle>
              ))}
            </g>
          </svg>
        </div>
      </section>

      <section className="key-metrics" aria-labelledby="metrics-title">
        <div className="company-section-label">
          <h2 id="metrics-title">핵심 지표</h2>
          <span>단위·비교값 모두 화면 예시</span>
        </div>
        <div className="metric-grid">
          {companyDetail.metrics.map((metric) => (
            <div key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small className={metric.tone === "success" ? "gain" : ""}>{metric.note}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="ai-evidence" aria-labelledby="evidence-title">
        <div className="company-section-label">
          <h2 id="evidence-title">AI 근거 비교</h2>
          <span>긍정·반대 근거 동일 위계 · 선택해 검증 정보 보기</span>
        </div>
        <div className="evidence-columns">
          {(["positive", "negative"] as const).map((kind) => (
            <div key={kind}>
              <h3>{kind === "positive" ? "긍정 근거" : "반대 근거"} <span>3</span></h3>
              {companyDetail.evidence.filter((item) => item.kind === kind).map((item) => (
                <button
                  className="detail-choice"
                  key={item.id}
                  type="button"
                  aria-pressed={selected.id === item.id}
                  onClick={() => selectEvidence(item)}
                >
                  <b>{item.title}</b>
                  <span>{item.subtitle}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="filings" aria-labelledby="filings-title">
        <div className="company-section-label">
          <h2 id="filings-title">공시·출처</h2>
          <span>{companyDetail.filingsConnected ? "OpenDART 실제 공시 연결" : "OpenDART 미연결 · 실제 접수번호 아님"}</span>
        </div>
        <div
          className="filing-list"
          role="listbox"
          aria-label={companyDetail.filingsConnected ? "OpenDART 실제 공시" : "화면 예시 공시"}
        >
          {companyDetail.filings.map((filing) => (
            <button
              className="filing-choice"
              key={filing.id}
              type="button"
              role="option"
              aria-selected={selected.id === filing.id}
              onClick={() => selectEvidence(filing)}
            >
              <span>{filing.id}</span>
              <b>{filing.title}</b>
              <time>{filing.subtitle}</time>
            </button>
          ))}
        </div>
        <p className="filing-warning">
          {companyDetail.filingsConnected
            ? "OpenDART 실제 공시 목록 · 원문 내용은 검증하지 않음 · 투자 판단·주문 사용 금지"
            : "실제 공시 검증 미수행 · 화면용 가상 예시 · 투자 판단·주문 사용 금지"}
        </p>
      </section>
    </article>
  );

  const inspector = (
    <aside className="company-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span>근거 검증 인스펙터</span>
          <h2>{selected.title}</h2>
          <p>
            {selected.kind === "filing"
              ? `${companyDetail.filingsConnected ? "OpenDART 실제 공시" : "화면 예시 공시"} · 선택됨`
              : `${selected.kind === "positive" ? "긍정 근거" : "반대 근거"} · 선택됨`}
          </p>
        </header>
        <section>
          <h3>선택 항목 설명</h3>
          <p>{selected.body}</p>
        </section>
        <section>
          <h3>검증 상태</h3>
          <dl>
            <div><dt>실제 공시 원문</dt><dd>{companyDetail.filingsConnected ? "OpenDART 연결됨" : "미연결"}</dd></div>
            <div><dt>실제 수치 검산</dt><dd>미수행</dd></div>
            <div><dt>외부 시세/API</dt><dd>미연결</dd></div>
            <div><dt>판단 사용 가능</dt><dd className="loss">금지</dd></div>
          </dl>
        </section>
        <section className="inspector-caution">
          <h3>안전 고지</h3>
          <p>이 화면은 정보 구조 검토를 위한 가상 예시입니다. 투자 권유가 아니며 실제 투자 판단이나 주문에 사용할 수 없습니다.</p>
        </section>
        <div className="inspector-source">
          <span>현재 선택</span>
          <strong>{selected.kind === "filing" ? selected.id : selected.sourceLabel}</strong>
          <small>{selected.sourceLabel}</small>
        </div>
      </div>
      <div className="company-inspector-actions">
        <button type="button" onClick={() => onNavigate("dashboard")}>
          <ArrowLeft size={13} /> 투자 운영 대시보드로 돌아가기
        </button>
        <p>
          <ShieldAlert size={12} />{" "}
          {companyDetail.filingsConnected ? "실제 시세·계좌·API 미연결 · 공시는 OpenDART 실제 연결" : "실제 시세·공시·계좌·API 미연결"}
        </p>
      </div>
    </aside>
  );

  return (
    <AppShell
      title="기업 상세"
      accountLabel="시뮬레이션 계좌"
      lastSync={formatTimeOfDay(envelope.dataAsOf)}
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}
