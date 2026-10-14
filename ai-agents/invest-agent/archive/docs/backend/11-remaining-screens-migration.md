# 나머지 17개 화면 백엔드 마이그레이션

기준일: 2026-09-01 KST

## 배경

`BACKEND-006`까지 6개 화면(대시보드·계좌·분석/검증/실행 에이전트·승인 대기)만 백엔드에 연결돼 있었다. 나머지 17개 화면(리스크 알림, 거래 내역, 포트폴리오 건강, 근거 패킷, 감사 로그, 결정 회고, 역할 상태, 주간 리포트, 세금·수수료, 변경 비교, 전략 조정, 백테스트, 기업 상세, 데이터 연결, 알림 설정, 투자 정책, 스트레스 테스트)는 여전히 `apps/web/src/fixtures/*.ts`의 프론트 전용 정적 데이터를 썼다.

이번 작업으로 **23개 화면 전부**가 백엔드 `GET` 엔드포인트에 연결됐고, `apps/web/src/fixtures/` 디렉터리는 완전히 비었다.

## 원칙: 읽기 전용 이관, 콘텐츠는 그대로

17개 화면 전부 `POST`/쓰기 없이 순수 `GET`으로 옮겼다. 정책/알림 설정 화면의 "가상 적용"·"토글"은 원래부터 **"저장되지 않는 화면 상태"** 로 명시된 로컬 UI 상태였다 — 백엔드가 초기값만 주고, 편집·적용은 그대로 프론트 state에 남는다. 새 저장 API를 만들지 않았다.

화면 텍스트와 숫자는 포팅 과정에서 임의로 다시 쓰지 않았다. 기존 TS fixture의 값을 그대로 Python 리터럴로 옮겼다.

## 화면별 새 파일

각 화면은 `app/schemas/<name>.py` + `app/fixtures/<name>.py` + `app/routers/<name>.py` + `tests/test_<name>.py` 4종 세트로 구성했다. 목록:

| 화면 | 엔드포인트 | 비고 |
|---|---|---|
| 리스크 알림 | `GET /api/risk-alerts` | |
| 모의 거래 내역 | `GET /api/trade-history` | DEC-1042 재사용(47일 전 이력, 낮은 우선순위 이슈로 남김) |
| 포트폴리오 건강 | `GET /api/portfolio-health` | `overallScore`를 서버에서 계산 |
| 승인 전 근거 패킷 | `GET /api/evidence-packets` | DEC-1042 실시간 상태 반영 |
| 감사 로그 | `GET /api/audit-logs` | DEC-1042/1043/1044 검증 후 값이 승인 대기와 동일한 숫자 |
| 결정 회고 | `GET /api/decision-review` | |
| 에이전트 역할 상태 | `GET /api/agent-role-status` | |
| 주간 투자 리포트 | `GET /api/weekly-report` | 기간별 계산 사전 처리 |
| 세금·수수료 영향 점검 | `GET /api/tax-fee-impact` | |
| 포트폴리오 변경 전/후 비교 | `GET /api/portfolio-change-compare` | |
| 전략 조정 | `GET /api/rebalance-plan` | 전략별 제안 사전 계산 |
| 백테스트 요약 | `GET /api/backtest-summary` | 9가지 조합 사전 계산 |
| 기업 상세 | `GET /api/company-detail` | 삼성전자 보유 수치를 대시보드에서 재사용 |
| 데이터 연결 상태 | `GET /api/data-connections` | |
| 알림 설정 | `GET /api/notification-settings` | 저장 없음 |
| 투자 정책 | `GET /api/policy-settings` | DEC-1042 미리보기 재사용 |
| 스트레스 테스트 | `GET /api/stress-test` | 시나리오별 충격 사전 계산 |

## 서버 사전 계산으로 옮긴 파생값

프론트 fixture에는 "선택된 필터/기간/전략에 따라 값을 계산하는 함수"가 여럿 있었다(`getRebalanceProposals`, `getBacktestMetrics`/`getBacktestRows`, `getStressRows`, 주간 리포트의 `summary`/`facts` 함수형 필드). 함수는 JSON으로 못 보내므로, **가능한 모든 조합을 서버에서 한 번 계산**해 응답에 포함시키고 프론트는 조회(lookup)만 하도록 바꿨다.

- 전략 조정: 3개 전략 각각의 제안 목록을 `proposalsByStrategy`로 미리 계산
- 백테스트: 3전략 × 3기간 = 9개 조합을 `metrics`/`rows`에 미리 계산
- 스트레스 테스트: 4개 시나리오 각각의 자산별 충격을 `rowsByScenario`로 미리 계산
- 주간 리포트: `summary`/`facts`가 기간에 따라 달라지던 항목을 `summaryByRange`/`factsByRange` 딕셔너리로 3개 기간 전부 미리 채움. 기간에 안 달라지던 항목은 3개 키에 같은 값을 반복해 넣어 타입을 균일하게 유지
- 포트폴리오 건강: `overallScore`(건강 점수) 계산도 서버로 이동

## 결정 데이터 통합 확장

`BACKEND-006`은 DEC-1042만 `decisions.py`로 통합했다. 이번에 DEC-1043(NAVER 매도), DEC-1044(KODEX 200 매수)도 추가해 `approvals.py`와 `audit_logs.py`가 같은 상수를 공유한다.

새로 발견한 재사용 지점:
- `evidence_packets.py`: DEC-1042 수량·가격·목표비중을 `decisions.py`에서 가져오고, 대시보드/승인 대기와 같은 승인 스토어를 조회해 실시간 상태 반영
- `policy_settings.py`의 미리보기: DEC-1042 금액·비중이 대시보드/승인 대기와 동일한지 테스트로 고정
- `company_detail.py`: 삼성전자 가격 패널(보유 수량·평균단가·평가액·손익·비중)을 새 값으로 만들지 않고 `build_dashboard_data().holdings`에서 코드로 찾아 재사용

## 확인했지만 이 문서 작성 시점엔 고치지 않았던 것

이 절은 `BACKEND-007` 완료 시점의 기록이다. 아래 두 항목은 이후 `docs/backend/12-full-decision-id-audit.md`에서 16개 결정 ID 전수 대조를 하면서 실제로 고쳤다 — 최신 상태는 그 문서를 본다.

- ~~`decision_review.py`의 DEC-1042 항목이 "2026-08-25 승인"이라는 과거 기록을 담고 있는데, 대시보드/승인 대기는 같은 ID를 "2026-08-27 신규 대기중"으로 보여준다.~~ → DEC-1058로 분리 완료.
- ~~16개 결정 ID 전체에 대한 전수 서사 대조는 하지 않았다.~~ → 전수 대조 완료. `agent_role_status.py`가 갖고 있던 미해결 DEC-1043 충돌(BACKEND-006에서 `agents.py`만 고치고 놓친 부분)과 `decision_review.py`의 DEC-1044 충돌도 이때 함께 발견해 고쳤다.

여전히 남아 있는 것: `trade_history.py`의 마지막 항목이 `id="DEC-1042"`를 47일 전 "정책 차단" 이력으로 재사용한다. 같은 ID, 같은 수량·가격이지만 시점이 다른 별개 사건처럼 보인다. 전수 대조에서 다시 확인했고, "동시에 반대 상태를 주장"하는 패턴이 아니라서(다른 시점의 별개 사건으로 읽힘) 이번에도 이름을 바꾸지 않았다. `weekly_report.py`·`risk_alerts.py`의 DEC-1042 재사용도 같은 이유로 남겨뒀다.

## 발견하고 고친 진짜 버그: React Hooks 순서 위반

마이그레이션 도중 `TaxFeeImpactPage`에서 실제 런타임 크래시("Rendered more hooks than during the previous render")를 발견했다. 원인은 이 프로젝트에 반복되는 패턴이었다.

```tsx
const [filter, setFilter] = useState(...);
const fallback = renderFixtureFallback(state, "...");
if (fallback) return fallback;   // 로딩 중엔 여기서 조기 반환

// ...
useEffect(() => { /* 테스트용 window 훅 등록 */ }, []);  // 조기 반환 아래에 있음
```

로딩 중인 렌더는 `useEffect`를 호출하지 않고, 로드 완료 후 렌더는 호출한다 — 같은 컴포넌트가 렌더마다 다른 개수의 훅을 부르는 React 규칙 위반이다. 데이터가 동기 상수였던 마이그레이션 이전에는 조기 반환 자체가 없어서 드러나지 않았던 버그다.

**영향받은 4개 페이지**: `TaxFeeImpactPage`, `DecisionReviewPage`, `AgentRoleStatusPage`, `PortfolioChangeComparePage`. 전부 같은 방식으로 고쳤다 — `useRef`로 조기 반환 전에 훅을 무조건 호출하고, 실제 핸들러는 데이터 로드 후에 `ref.current`에 대입한다.

```tsx
const testHookRef = useRef<(filter) => void>(() => {});

useEffect(() => {
  const forward = (filter) => testHookRef.current(filter);
  Object.defineProperty(window, "__setXFilterForTest", { value: forward, ... });
  return () => { delete window.__setXFilterForTest; };
}, []); // 훅은 항상 호출됨, 위치 무관

const fallback = renderFixtureFallback(state, "...");
if (fallback) return fallback;

// ... envelope 로드 후 ...
testHookRef.current = (filter) => { /* 진짜 로직 */ };
```

`DashboardPage`와 `ApprovalQueuePage`는 애초에 `useEffect`를 조기 반환보다 위에 뒀어서 이 버그가 없었다.

## 검증

- `uv run pytest`: 39개(BACKEND-006 종료 시점) → **108개**
- `npm run typecheck`, `npm run build`: 통과
- `apps/web/src/fixtures/`: 완전히 비어 있음(디렉터리 자체가 없어짐)
- 브라우저로 23개 화면 전부 순회: 1440×900에서 셸 1392×852 유지, 문서 가로·세로 오버플로 0, 에러 화면 0
- 새 탭에서 콘솔 오류 0건 확인(하나의 탭에서 크래시가 났던 로그가 남아 있어 새 탭으로 교차 검증함 — 콘솔 로그 버퍼는 같은 탭 안에서 새로고침해도 안 지워진다는 점에 유의)
- 4개 테스트 훅 페이지: 실제 클릭 또는 `window.__setXFilterForTest()` 호출로 훅이 정상 동작하는지 확인
- 승인 대기 화면: 4건 정상 로드 확인
