# 데이터 원칙과 API 계약

기준일: 2026-08-29 KST

## 데이터 원칙

1차 백엔드는 `BACKEND-002`에서 `apps/api` 최소 골격과 `GET /api/health` 단독 엔드포인트까지 생성했다. 화면별 API를 만들 때도 실제 DB 없이 시작한다. 현재 `apps/web` 프론트는 로컬 fixture 모듈로 정적 목업 19개에 대응하는 화면 데이터를 표시한다.

- Python 코드 또는 JSON fixture로 고정 데이터를 제공한다.
- 서버 재시작 시 상태가 초기화되어도 된다.
- 승인·반려 같은 변경은 메모리 저장소에만 반영한다.
- 모든 fixture에는 `asOf`, `sourceLabel`, `isMock`, `disclaimer`를 포함한다.
- 금액, 수익률, 비중은 **원본 숫자만** 내려주고 화면 문자열은 프론트가 만든다. `BACKEND-003`에서 확정했다.
  - 금액은 응답의 `currency` 기준 정수다. `128450000`
  - 비율은 퍼센트 단위 실수다. `6.65`는 6.65%다.
  - 해당 없는 값은 `"-"`나 `""`가 아니라 `null`이다.
  - 시각은 KST 오프셋을 포함한 ISO 8601 문자열이다.
- 이 규칙은 이후 비용·비중·위험 계산을 서버로 옮길 때 계약을 다시 뜯지 않기 위한 것이다. 자세한 예시는 `docs/backend/07-dashboard-api.md`를 본다.

## 공통 응답 예시

```json
{
  "generatedAt": "2026-08-27T16:30:00+09:00",
  "dataAsOf": "2026-08-27T15:20:00+09:00",
  "isMock": true,
  "disclaimer": "화면 검토용 가상 예시이며 실제 계좌·주문·API와 연결되지 않습니다.",
  "data": {}
}
```

## API 범위

실제 외부 API가 아니라 프론트엔드가 호출하는 **내부 로컬 API**만 만든다. `BACKEND-007`로 23개 화면 전부가 아래 엔드포인트에 연결됐다. 이 표가 실제 구현과 유일하게 맞는 기준이다 — 화면별 세부 계약은 `docs/backend/07-dashboard-api.md`, `08-account-and-agent-api.md`, `09-approvals-api.md`, `11-remaining-screens-migration.md`를 참조한다.

| Method | Endpoint | 화면 |
|---|---|---|
| `GET` | `/api/health` | 백엔드 상태 확인 |
| `GET` | `/api/dashboard` | 투자 운영 대시보드 |
| `GET` | `/api/account` | 계좌 |
| `GET` | `/api/agents/analysis` | 분석 에이전트 |
| `GET` | `/api/agents/verification` | 검증 에이전트 |
| `GET` | `/api/agents/execution` | 실행 에이전트 |
| `GET` | `/api/approvals` | 승인 대기 |
| `POST` | `/api/approvals/{id}/approve` | 승인 대기 · 모의승인 |
| `POST` | `/api/approvals/{id}/reject` | 승인 대기 · 반려 |
| `GET` | `/api/risk-alerts` | 리스크 알림 |
| `GET` | `/api/trade-history` | 모의 거래 내역 |
| `GET` | `/api/portfolio-health` | 포트폴리오 건강 |
| `GET` | `/api/evidence-packets` | 승인 전 근거 패킷 |
| `GET` | `/api/audit-logs` | 감사 로그 |
| `GET` | `/api/decision-review` | 결정 회고 |
| `GET` | `/api/agent-role-status` | 에이전트 역할 상태 |
| `GET` | `/api/weekly-report` | 주간 투자 리포트 |
| `GET` | `/api/tax-fee-impact` | 세금·수수료 영향 점검 |
| `GET` | `/api/portfolio-change-compare` | 포트폴리오 변경 전/후 비교 |
| `GET` | `/api/rebalance-plan` | 전략 조정 |
| `GET` | `/api/backtest-summary` | 백테스트 요약 |
| `GET` | `/api/company-detail` | 기업 상세 |
| `GET` | `/api/data-connections` | 데이터 연결 상태 |
| `GET` | `/api/notification-settings` | 알림 설정 |
| `GET` | `/api/policy-settings` | 투자 정책 |
| `GET` | `/api/stress-test` | 스트레스 테스트 |

모든 `POST`는 실제 금융 행동이 아니라 로컬 데모 상태만 바꾼다. 정책·알림 설정의 "가상 적용"·토글은 저장 API 없이 프론트 화면 상태로만 남는다.
