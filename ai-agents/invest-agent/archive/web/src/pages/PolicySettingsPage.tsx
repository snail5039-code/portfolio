import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { applyPolicySettings, getPolicySettings } from "../api/policySettings";
import { ApiError } from "../api/client";
import { AppShell } from "../components/AppShell";
import { renderFixtureFallback } from "../components/FixtureFallback";
import { useFixture } from "../lib/useFixture";
import { formatPercent, formatWon } from "../lib/format";
import type { PageKey, PolicyCheckKey, PolicyNumberKey, PolicyNumberRule, PolicySettingsData } from "../types/dashboard";
import "./PolicySettingsPage.css";

function formatAppliedAt(appliedAt: string | null): string {
  if (!appliedAt) return "저장된 적용 없음 · 화면 기본값 표시 중";
  const time = new Date(appliedAt).toLocaleString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `가상 적용됨 · 서버에 저장됨 (${time} 적용, 재시작해도 유지)`;
}

type PolicyValues = Record<PolicyNumberKey, string> & Record<PolicyCheckKey, boolean>;
type NumberErrors = Partial<Record<PolicyNumberKey, string>>;

function buildInitialValues(data: PolicySettingsData): PolicyValues {
  return {
    ...Object.fromEntries(data.numberRules.map((rule) => [rule.key, rule.value])),
    ...Object.fromEntries(data.checks.map((check) => [check.key, check.value]))
  } as PolicyValues;
}

function validateNumbers(values: PolicyValues, numberRules: PolicyNumberRule[]) {
  const errors: NumberErrors = {};
  let ok = true;
  for (const rule of numberRules) {
    const raw = values[rule.key].trim();
    const numeric = Number(raw);
    const pattern = rule.decimals > 0 ? /^\d+(?:\.\d{1})?$/ : /^\d+$/;
    const onStep =
      Number.isFinite(numeric) &&
      Math.abs((numeric - rule.min) / rule.step - Math.round((numeric - rule.min) / rule.step)) < 1e-8;
    let message = "";
    if (raw === "" || !Number.isFinite(numeric) || numeric < rule.min || numeric > rule.max) {
      message = `${rule.min.toLocaleString("ko-KR")}~${rule.max.toLocaleString("ko-KR")} 범위로 입력하세요.`;
    } else if (!pattern.test(raw)) {
      message = rule.decimals > 0 ? `소수 ${rule.decimals}자리까지 입력하세요.` : "정수로 입력하세요.";
    } else if (!onStep) {
      message = rule.step < 1 ? `${rule.step} 단위로 입력하세요.` : `${rule.step.toLocaleString("ko-KR")} 단위로 입력하세요.`;
    }
    if (message) {
      errors[rule.key] = message;
      ok = false;
    }
  }
  return { ok, errors };
}

function changedKeys(values: PolicyValues, applied: PolicyValues, numberKeys: PolicyNumberKey[], checkKeys: PolicyCheckKey[]) {
  return [...numberKeys, ...checkKeys].filter((key) => String(values[key]) !== String(applied[key]));
}

interface PolicySettingsPageProps {
  activePage: PageKey;
  onNavigate: (page: PageKey) => void;
}

export function PolicySettingsPage({ activePage, onNavigate }: PolicySettingsPageProps) {
  const state = useFixture<PolicySettingsData>(() => getPolicySettings(), "policy-settings");
  const [values, setValues] = useState<PolicyValues | null>(null);
  const [applied, setApplied] = useState<PolicyValues | null>(null);
  // `undefined` means "no apply happened yet this page session — trust the
  // server's own appliedAt from the initial GET" (which already reflects a
  // save from an earlier session, since the server merges it into
  // numberRules/checks before this page ever sees them).
  const [appliedAt, setAppliedAt] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  const fallback = renderFixtureFallback(state, "투자 정책");
  if (fallback) return fallback;

  const envelope = state.envelope;
  if (!envelope) return null;

  const policySettings = envelope.data;
  const initialValues = buildInitialValues(policySettings);
  const currentValues = values ?? initialValues;
  const currentApplied = applied ?? initialValues;
  const currentAppliedAt = appliedAt === undefined ? policySettings.appliedAt : appliedAt;
  const saveStatus = saving ? "서버에 저장하는 중..." : (localNotice ?? formatAppliedAt(currentAppliedAt));
  const numberKeys = policySettings.numberRules.map((rule) => rule.key);
  const checkKeys = policySettings.checks.map((check) => check.key);
  const validation = validateNumbers(currentValues, policySettings.numberRules);
  const changes = changedKeys(currentValues, currentApplied, numberKeys, checkKeys);

  const warnings = [
    currentValues.marketOrder ? "시장가 허용 시 가격 상한이 없습니다." : "",
    !currentValues.blockUnknown ? "출처 미확인 주문 자동 차단이 꺼져 있습니다." : "",
    !currentValues.blockCorrection ? "정정 공시 미확인 주문 자동 차단이 꺼져 있습니다." : "",
    !currentValues.limitOrder ? "지정가 주문이 허용되지 않습니다." : ""
  ].filter(Boolean);

  const maxOrder = Number(currentValues.maxOrder);
  const maxWeight = Number(currentValues.maxWeight);
  const amountOk = validation.ok && policySettings.preview.amount <= maxOrder;
  const weightOk = validation.ok && policySettings.preview.nextWeight <= maxWeight;
  const orderOk = currentValues.limitOrder;
  const sourceOk = !currentValues.blockUnknown;
  const blocked = !validation.ok || !amountOk || !weightOk || !orderOk || !sourceOk;

  function updateNumber(key: PolicyNumberKey, value: string) {
    setValues((current) => ({ ...(current ?? initialValues), [key]: value }));
  }

  function updateCheck(key: PolicyCheckKey, value: boolean) {
    setValues((current) => ({ ...(current ?? initialValues), [key]: value }));
  }

  function resetDefaults() {
    setValues(initialValues);
    setLocalNotice("초기값으로 되돌렸습니다. 아직 저장 전입니다.");
  }

  function cancelChanges() {
    setValues(currentApplied);
    setLocalNotice("변경을 취소했습니다. 저장된 값은 그대로입니다.");
  }

  async function applyMockPolicy() {
    if (!validation.ok || saving) return;
    setSaving(true);
    setLocalNotice(null);
    try {
      const result = await applyPolicySettings(currentValues);
      setApplied(currentValues);
      setAppliedAt(result.data.appliedAt);
    } catch (err) {
      setLocalNotice(err instanceof ApiError ? `저장 실패: ${err.message}` : "가상 적용 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const main = (
    <section className="policy-main" aria-labelledby="policy-title">
      <header className="policy-header">
        <div>
          <span className="eyebrow">설정</span>
          <h1 id="policy-title">투자 정책</h1>
          <p>화면 검토용 가상 설정이며 실제 계좌에 적용되지 않습니다.</p>
        </div>
        <button type="button" onClick={resetDefaults}>
          <RotateCcw size={13} /> 초기값으로 되돌리기
        </button>
      </header>

      <form className="policy-form" noValidate>
        <fieldset>
          <legend>포트폴리오 한도</legend>
          <div className="policy-field-grid">
            {policySettings.numberRules.slice(0, 4).map((rule) => (
              <PolicyNumberField key={rule.key} rule={rule} value={currentValues[rule.key]} error={validation.errors[rule.key]} onChange={updateNumber} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>검증·승인 조건</legend>
          <div className="policy-field-grid">
            {policySettings.numberRules.slice(4).map((rule) => (
              <PolicyNumberField key={rule.key} rule={rule} value={currentValues[rule.key]} error={validation.errors[rule.key]} onChange={updateNumber} />
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>주문·출처 차단</legend>
          <div className="policy-checks">
            {policySettings.checks.map((check) => (
              <label key={check.key}>
                <input type="checkbox" checked={currentValues[check.key]} onChange={(event) => updateCheck(check.key, event.currentTarget.checked)} />
                {check.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="policy-note">
          <b>구성 설명</b>
          <p>최소 현금 비중은 전체 유동성 하한이고 종목별 최대 비중은 개별 자산 상한이므로 단순 합계가 100%를 넘는 직접 충돌 검사가 아닙니다.</p>
        </div>
      </form>
    </section>
  );

  const inspector = (
    <aside className="policy-inspector" aria-live="polite" aria-atomic="false">
      <div className="inspector-scroll">
        <header>
          <span>현재 변경 요약</span>
          <h2>{changes.length ? `${changes.length}개 변경` : "변경 없음"}</h2>
          <p>{changes.length ? "가상 적용 전 변경사항이 있습니다." : "현재 가상 적용 상태와 같습니다."}</p>
        </header>
        <section>
          <h3>정책 충돌 검사</h3>
          {warnings.length ? (
            warnings.map((warning) => (
              <div className="policy-warning-item" key={warning}>
                <b>높음 경고</b>
                <small>{warning}</small>
              </div>
            ))
          ) : (
            <p className="policy-ok-item">직접 충돌 없음</p>
          )}
        </section>
        <section>
          <h3>{policySettings.preview.decisionId} 가상 적용 미리보기</h3>
          <dl>
            <div><dt>계산</dt><dd>{policySettings.preview.calculation}</dd></div>
            <div><dt>주문 금액 한도</dt><dd>{amountOk ? `허용: ${formatWon(policySettings.preview.amount)} <= ${maxOrder.toLocaleString("ko-KR")}원` : `차단: ${formatWon(policySettings.preview.amount)}이 한도 초과`}</dd></div>
            <div><dt>종목 비중</dt><dd>{formatPercent(policySettings.preview.currentWeight)} → {formatPercent(policySettings.preview.nextWeight)}</dd></div>
            <div><dt>종목 비중 한도</dt><dd>{weightOk ? `허용: ${formatPercent(policySettings.preview.nextWeight)} <= ${maxWeight.toFixed(1)}%` : `차단: ${formatPercent(policySettings.preview.nextWeight)}가 한도 초과`}</dd></div>
            <div><dt>주문 유형</dt><dd>{policySettings.preview.orderType}</dd></div>
            <div><dt>지정가 정책</dt><dd>{orderOk ? "허용: 지정가 사용 가능" : "차단: 지정가 미허용"}</dd></div>
            <div><dt>출처</dt><dd>{policySettings.preview.sourceState}</dd></div>
            <div><dt>출처 정책</dt><dd>{sourceOk ? "허용: 미확인 출처 차단 꺼짐" : "차단: 출처 미확인"}</dd></div>
            <div><dt>가상 판정</dt><dd className={blocked ? "preview-blocked" : "preview-allowed"}>{blocked ? "차단 예시" : "조건부 통과 예시"}</dd></div>
          </dl>
          <p>실제 주문 금지 · 실제 정책 검사 아님</p>
        </section>
        <section>
          <h3>저장 상태</h3>
          <p>{saveStatus}</p>
        </section>
      </div>
      <footer>
        <div role="status">{validation.ok ? "" : "입력 오류를 수정해야 가상 적용할 수 있습니다."}</div>
        <div>
          <button type="button" onClick={cancelChanges}>변경 취소</button>
          <button type="button" disabled={!validation.ok || !changes.length || saving} onClick={applyMockPolicy}>
            {saving ? "저장 중..." : "가상 정책 적용"}
          </button>
        </div>
        <small>{policySettings.safetyCopy}</small>
      </footer>
    </aside>
  );

  return (
    <AppShell
      title="투자 정책"
      accountLabel="시뮬레이션 계좌"
      lastSync="14:32"
      activePage={activePage}
      onNavigate={onNavigate}
      main={main}
      inspector={inspector}
    />
  );
}

interface PolicyNumberFieldProps {
  rule: PolicyNumberRule;
  value: string;
  error?: string;
  onChange: (key: PolicyNumberKey, value: string) => void;
}

function PolicyNumberField({ rule, value, error, onChange }: PolicyNumberFieldProps) {
  return (
    <div className="policy-field">
      <label htmlFor={rule.key}>{rule.label}</label>
      <div>
        <input
          id={rule.key}
          type="number"
          value={value}
          min={rule.min}
          max={rule.max}
          step={rule.step}
          aria-invalid={Boolean(error)}
          aria-describedby={`${rule.key}Help ${rule.key}Error`}
          onChange={(event) => onChange(rule.key, event.currentTarget.value)}
        />
        <span>{rule.unit}</span>
      </div>
      <small id={`${rule.key}Help`}>{rule.help}</small>
      <em id={`${rule.key}Error`}>{error ?? ""}</em>
    </div>
  );
}
