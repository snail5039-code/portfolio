# 금융 AI 투자·검증 에이전트 구현 명세

> 기준 기획: `FINANCIAL_AI_AGENT_IDEA.md`  
> 문서 목적: 기획의 기능 목록을 반복하지 않고, MVP를 실제 코드와 화면으로 옮기기 위한 기술·API·데이터·UI 계약을 정의한다.  
> 기본 원칙: 국내 주식, 모의투자, 읽기 가능한 근거, 결정적 계산, 실행 전 검증을 우선한다.

> 진행 순서 변경: 실제 구현에 앞서 `FINANCIAL_AI_SITE_MOCKUP_PLAN.md`의 최초 사이트 디자인 목업을 먼저 제작·검토·확정한다. 본 구현 명세는 목업 승인 이후 사용한다.

## 1. MVP 완료 상태

첫 번째 실행 가능한 버전은 다음 시나리오를 처음부터 끝까지 수행한다.

1. 사용자가 관심 종목 5~10개와 위험 한도를 설정한다.
2. 시스템이 기업·공시·재무·가격 데이터를 수집하고 기준 시각을 기록한다.
3. 투자 에이전트가 구조화된 제안을 만든다.
4. 검증 에이전트가 숫자, 출처, 최신성, 위험 정책을 독립적으로 검사한다.
5. 수정이 필요하면 최대 2회 재분석하고, 합의하지 못하면 사용자에게 넘긴다.
6. 검증된 제안만 모의주문으로 변환한다.
7. 자동 실행 범위를 벗어나면 macOS 스타일 인스펙터에서 승인 또는 반려한다.
8. 주문 결과, 보유자산, 손익, 결정·검증 이력이 대시보드에 반영된다.

MVP에서는 실제 자금 주문, 은행 이체, 자동 미세조정, 범용 종목 발굴을 구현하지 않는다.

## 2. 권장 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 웹 | Next.js 15+, TypeScript, App Router | 대시보드와 API BFF를 한 저장소에서 빠르게 개발 |
| UI | Tailwind CSS, Radix UI primitives | macOS 외형은 직접 구성하고 접근성 동작만 재사용 |
| 상태·조회 | TanStack Query, Zustand | 서버 데이터와 창·선택 상태를 분리 |
| 차트 | Apache ECharts | 시계열, 벤치마크, drawdown을 한 라이브러리로 처리 |
| 표 | TanStack Table | 고밀도 보유종목·주문·감사 로그 구현 |
| 백엔드 | Python 3.12, FastAPI, Pydantic v2 | 금융 계산, 데이터 처리, 에이전트 도구 스키마에 적합 |
| 워크플로 | LangGraph | 분석→검증→승인 중단→재개 상태를 체크포인트로 보존 |
| 비동기 작업 | Redis + Celery 또는 Dramatiq | 공시 수집, 재검증, 주문 상태 확인을 요청과 분리 |
| DB | PostgreSQL 16 | 결정·승인·주문 간 관계와 감사 이력 보존 |
| 벡터 검색 | pgvector | MVP에서 별도 벡터 DB 운영을 피함 |
| 파일 저장 | 로컬 S3 호환 저장소(MinIO), 운영 S3 | 공시 원문, 파싱 결과, 리포트 보관 |
| 관측 | OpenTelemetry + 자체 감사 로그 | 모델 호출과 금융 실행 로그를 분리해 추적 |
| 테스트 | pytest, Vitest, Playwright | 계산·API·핵심 승인 흐름을 계층별 검증 |

초기 로컬 개발은 Docker Compose로 PostgreSQL과 Redis만 실행한다. 프론트엔드와 API는 개발 서버로 실행해 수정 속도를 높인다.

## 3. 저장소 구조

```text
financial-ai-agent/
├─ apps/
│  ├─ web/                       # Next.js 데스크톱형 UI
│  │  ├─ app/
│  │  ├─ components/
│  │  │  ├─ shell/              # titlebar, source-list, inspector
│  │  │  ├─ portfolio/
│  │  │  ├─ agents/
│  │  │  └─ approvals/
│  │  └─ lib/api/
│  └─ api/                       # FastAPI 진입점
│     ├─ routers/
│     ├─ dependencies/
│     └─ main.py
├─ packages/
│  ├─ domain/                    # 공통 enum, DTO, 상태 전이
│  ├─ calculations/              # 재무·손익·위험 결정적 계산
│  ├─ connectors/                # OpenDART, 시세, 모의 브로커
│  ├─ agents/                    # LangGraph 노드와 프롬프트
│  ├─ policy-engine/             # 한도·승인 등급 판정
│  └─ reporting/                 # 웹 리포트 데이터 구성
├─ migrations/
├─ tests/
│  ├─ fixtures/                  # 시점이 고정된 공시·가격 샘플
│  ├─ contract/
│  ├─ integration/
│  └─ e2e/
├─ docs/
│  ├─ api/
│  ├─ decisions/
│  └─ runbooks/
├─ docker-compose.yml
└─ .env.example
```

프론트엔드와 백엔드는 하나의 모노레포에서 관리하되, 주문 실행 코드는 웹 서버에서 호출하지 않는다. API가 정책 검사와 실행 토큰 검사를 끝낸 뒤 브로커 어댑터를 호출한다.

## 4. 시스템 경계

```text
Next.js UI
   │ REST + SSE
FastAPI BFF / Domain API
   ├─ Portfolio Service
   ├─ Evidence Service ───── OpenDART / Market Data / ECOS
   ├─ Agent Orchestrator ─── LangGraph + LLM
   ├─ Calculation Engine
   ├─ Policy & Approval Service
   ├─ Execution Service ──── Paper Broker / KIS Sandbox
   └─ Audit & Report Service
        │
PostgreSQL + pgvector / Redis / Object Storage
```

- REST는 조회·명령에 사용한다.
- SSE는 에이전트 실행 단계, 승인 요청, 주문 상태를 화면에 전달한다.
- WebSocket은 실시간 시세가 실제로 필요한 단계에서만 추가한다.
- LLM은 외부 금융 API와 주문 API에 직접 접근하지 않는다.
- 계산 서비스와 정책 엔진은 같은 입력에 항상 같은 결과를 내야 한다.

## 5. 핵심 도메인 모델

### 5.1 주요 테이블

| 테이블 | 핵심 필드 | 역할 |
|---|---|---|
| `users` | `id`, `timezone`, `base_currency` | 사용자 기본 설정 |
| `investment_policies` | 한도, 허용 자산, 승인 규칙, `version` | 결정 당시 정책을 버전으로 고정 |
| `portfolios` | `id`, `mode`, `benchmark_code` | 모의/실거래 경계 |
| `accounts` | `broker`, `environment`, 암호화 참조키 | 계좌 연결 메타데이터 |
| `instruments` | 종목코드, 시장, 통화, 산업 | 자산 마스터 |
| `data_snapshots` | `source`, `as_of`, `received_at`, `hash` | 분석에 사용한 데이터 시점 |
| `filings` | 접수번호, 보고서 버전, 연결/별도, 원문 위치 | 공시 근거 |
| `evidence_items` | 주장, 원문 인용 위치, 출처, 기준일 | UI에서 근거 역추적 |
| `agent_runs` | 실행 상태, 현재 노드, revision, 오류 | LangGraph 실행 단위 |
| `proposals` | 행동, 종목, 목표 비중, 근거, 무효 조건 | 투자 제안 |
| `verifications` | 판정, 오류 목록, 재계산, 신뢰도 | 독립 검증 결과 |
| `approvals` | 등급, 만료, 승인자, 승인 시세 | 사용자 승인 |
| `orders` | 멱등키, 주문 상태, 수량, 가격, broker id | 주문 수명주기 |
| `fills` | 체결 수량, 가격, 비용, 체결 시각 | 실제 모의 체결 결과 |
| `positions` | 수량, 평균단가, 평가손익 | 현재 보유 상태 |
| `audit_events` | actor, action, before/after, trace id | 변경 불가능한 업무 기록 |

### 5.2 상태 enum

```text
AgentRun: QUEUED → COLLECTING → ANALYZING → VERIFYING
          → REVISING | WAITING_APPROVAL | REJECTED | EXECUTING | COMPLETED | FAILED

Verification: APPROVED | CONDITIONAL | REJECTED | USER_DECISION_REQUIRED

Approval: NOT_REQUIRED | PENDING | APPROVED | REJECTED | EXPIRED | INVALIDATED

Order: PROPOSED → VALIDATED → SUBMITTED → ACCEPTED
       → PARTIALLY_FILLED → FILLED | CANCELLED | REJECTED | FAILED
```

상태 전이는 도메인 함수 한 곳에서만 허용한다. API 라우터나 UI가 DB 상태를 임의 변경하지 않는다.

## 6. 내부 API v1

모든 응답은 `request_id`, `data_as_of`, `generated_at`을 포함한다. 근거가 있는 값은 `evidence_ids`를 함께 반환한다.

### 6.1 대시보드와 포트폴리오

| Method | Endpoint | 용도 |
|---|---|---|
| `GET` | `/v1/dashboard/summary?portfolio_id=` | 총자산, 손익, 위험, 대기 작업 통합 조회 |
| `GET` | `/v1/portfolios/{id}/performance?range=1M` | 자산·벤치마크·drawdown 시계열 |
| `GET` | `/v1/portfolios/{id}/positions` | 고밀도 보유종목 표 |
| `GET` | `/v1/portfolios/{id}/allocation?group_by=sector` | 자산·산업·통화별 비중 |
| `GET` | `/v1/portfolios/{id}/risk` | 집중도, 변동성, 최대 낙폭, 한도 접근 상태 |

### 6.2 분석과 근거

| Method | Endpoint | 용도 |
|---|---|---|
| `POST` | `/v1/agent-runs` | 종목 분석 또는 포트폴리오 점검 시작 |
| `GET` | `/v1/agent-runs/{id}` | 현재 노드, 결과, 수정 횟수 조회 |
| `GET` | `/v1/agent-runs/{id}/events` | SSE 진행 이벤트 |
| `GET` | `/v1/proposals/{id}` | 구조화된 투자 제안 조회 |
| `GET` | `/v1/verifications/{id}` | 검증 판정과 오류·재계산 조회 |
| `GET` | `/v1/evidence/{id}` | 원문 위치, 기준일, 해시, 계산식 조회 |
| `GET` | `/v1/companies/{code}/financials` | 표준화 재무와 산업 비교 조회 |
| `GET` | `/v1/companies/{code}/filings` | 공시 목록과 정정 관계 조회 |

`POST /v1/agent-runs` 요청 예시:

```json
{
  "portfolio_id": "pf_demo",
  "policy_version": 3,
  "scope": { "type": "INSTRUMENT", "codes": ["005930"] },
  "intent": "REVIEW_HOLDING",
  "execution_mode": "PAPER",
  "client_request_id": "01J..."
}
```

### 6.3 승인과 실행

| Method | Endpoint | 용도 |
|---|---|---|
| `GET` | `/v1/approvals?status=PENDING` | 승인 대기 목록 |
| `POST` | `/v1/approvals/{id}/approve` | 표시된 조건에 대한 명시적 승인 |
| `POST` | `/v1/approvals/{id}/reject` | 반려와 사유 기록 |
| `POST` | `/v1/orders` | 검증·정책·승인이 유효한 주문만 제출 |
| `GET` | `/v1/orders/{id}` | 주문·체결 상태 조회 |
| `POST` | `/v1/orders/{id}/cancel` | 취소 가능 상태에서 취소 요청 |
| `POST` | `/v1/system/kill-switch` | 신규 실행 차단, 기존 주문 상태 확인 전용 전환 |

승인은 금액만 승인하는 것이 아니라 `proposal_hash`, `symbol`, `side`, `max_quantity`, `price_guard`, `expires_at`에 묶인 토큰으로 저장한다. 가격 가드 이탈, 제안 변경, 만료 중 하나가 발생하면 재승인을 요구한다.

## 7. 에이전트 구현 계약

### 7.1 LangGraph 노드

```text
load_policy
  → collect_evidence
  → normalize_financials
  → calculate_metrics
  → draft_proposal
  → independent_verification
  → route_verification
      ├─ revise_proposal (최대 2회) ─┐
      ├─ reject → finalize           │
      └─ policy_check ←──────────────┘
            ├─ auto → build_order
            ├─ approval → interrupt
            └─ forbidden → finalize
  → preflight_execution
  → execute_paper_order
  → reconcile
  → update_portfolio
  → finalize
```

### 7.2 출력 스키마

- 투자 에이전트: `action`, `target_weight`, `time_horizon`, `thesis`, `evidence_ids`, `calculations`, `counter_evidence`, `risks`, `invalidation_conditions`.
- 검증 에이전트: `verdict`, `claim_checks`, `calculation_checks`, `freshness_checks`, `policy_findings`, `missing_evidence`, `required_changes`.
- 실행 에이전트: 자연어를 받지 않고 검증된 `OrderCommand`만 받는다.

모델 응답은 Pydantic 검증에 실패하면 한 번만 스키마 수정 요청을 보낸다. 재실패 시 실행을 중지하고 `FAILED_SCHEMA_VALIDATION`으로 기록한다.

### 7.3 독립성 규칙

- 검증 노드에는 투자 에이전트의 숨은 추론이나 이전 프롬프트를 전달하지 않는다.
- 제안의 주장, 근거 ID, 계산식만 전달한다.
- 검증 노드는 원문과 계산 함수를 다시 호출한다.
- 동일 숫자가 같은 중간 캐시에서 왔더라도 원본 스냅샷 해시와 단위를 재확인한다.
- 검증 판정은 LLM 결과만으로 끝내지 않고 결정적 검사 결과를 우선한다.

## 8. 외부 API 어댑터

모든 외부 연동은 다음 인터페이스 뒤에 둔다.

```python
class DisclosureProvider: ...
class MarketDataProvider: ...
class MacroDataProvider: ...
class BrokerAdapter: ...
```

1차 구현 순서:

1. `FixtureDisclosureProvider`: 테스트 공시 JSON.
2. `FixtureMarketDataProvider`: 고정 가격 시계열.
3. `PaperBrokerAdapter`: 수수료와 슬리피지를 반영한 내부 모의체결.
4. `OpenDartProvider`: 기업·공시·재무 데이터.
5. `KisMarketDataAdapter`: 모의 시세·계좌 조회.
6. `KisPaperBrokerAdapter`: 공식 모의투자 주문.

외부 응답 원문은 먼저 저장하고 정규화한다. 재시도는 조회 요청에만 지수 백오프를 적용하며, 주문 타임아웃 시 재주문하지 않고 주문번호·멱등키로 상태 조회를 먼저 수행한다.

## 9. macOS 스타일 화면 명세

### 9.1 공통 앱 셸

```text
┌─ 통합 타이틀바: ● ● ● | 화면 제목 | 포트폴리오 | 검색 | 동기화 시각 ─┐
├──────────────┬────────────────────────────────────┬───────────────┤
│ Source List  │ Main Workspace                     │ Inspector     │
│ 220~248 px   │ min 640 px                         │ 320~380 px    │
└──────────────┴────────────────────────────────────┴───────────────┘
```

- 창 배경과 사이드바는 macOS 재질감을 연상시키되 `backdrop-filter`는 성능 저하가 없을 때만 사용한다.
- 기본 글꼴은 `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Noto Sans KR", sans-serif`.
- 모서리 반경은 팝오버·버튼에만 6~10px로 제한한다. 콘텐츠 전체를 둥근 카드로 만들지 않는다.
- 1px 구분선과 행 선택 배경으로 정보 구조를 표현한다.
- 숫자는 `font-variant-numeric: tabular-nums`를 사용하고 우측 정렬한다.
- 상승은 초록, 하락은 빨강, 경고는 주황, 선택은 시스템 파랑으로 제한한다.
- 라이트·다크 토큰을 CSS 변수로 제공하고 WCAG AA 대비를 맞춘다.

### 9.2 좌측 소스 리스트

```text
투자 운영
  포트폴리오
  계좌
  거래 내역

에이전트
  분석 에이전트        1
  검증 에이전트        2
  실행 에이전트
  승인 대기            1

문서
  투자 리포트
  감사 로그

설정
  투자 정책
  데이터 연결
```

아이콘은 16px 단색 선형 아이콘을 사용한다. 숫자 표시는 실제 미처리 항목이 있을 때만 보인다.

### 9.3 투자 운영 화면

중앙 작업 영역은 카드 모음이 아니라 세로로 연결된 분석 작업면으로 만든다.

```text
[총자산 128,450,000원]  [오늘 +0.82%]  [현금 18.4%]  기준 14:32:10
────────────────────────────────────────────────────────────────────
기간 1일 1주 1개월 3개월 1년 전체       자산 / 벤치마크 / 낙폭
┌──────────────────── 자산 시계열 차트 ────────────────────────────┐
└───────────────────────────────────────────────────────────────────┘
보유 종목 | 수량 | 평균단가 | 현재가 | 평가금액 | 손익 | 비중 | 상태
────────────────────────────────────────────────────────────────────
삼성전자  | ...                                                     
```

- 상단 숫자를 클릭하면 계산 근거와 데이터 기준 시각을 팝오버로 표시한다.
- 차트 커서는 동일 시점의 자산, 벤치마크, 누적 입출금, drawdown을 함께 보여준다.
- 보유종목 행을 선택하면 중앙 차트와 우측 인스펙터가 해당 종목으로 전환된다.
- 표 헤더는 고정하고 키보드 방향키로 행을 이동할 수 있게 한다.

### 9.4 우측 에이전트 인스펙터

```text
판단 #DEC-1042                         조건부 승인
삼성전자 · 비중 12% → 15%
────────────────────────────────────────────
분석       검증       실행
● 완료  ─  ● 완료  ─  ○ 승인 대기

제안
  10주 지정가 매수 · 최대 712,000원

핵심 근거
  영업현금흐름 개선                      ›
  산업 평균 대비 낮은 부채비율           ›

검증 결과
  수치 8/8 일치 · 출처 5/5 확인
  주의: 최근 가격 변동성 확대            ›

최악 시나리오 / 무효 조건                ›
────────────────────────────────────────────
[반려]                    [주문 내용 승인]
이 요청은 14:42에 만료됩니다.
```

- 탭이 아니라 한 화면에서 분석→검증→실행 순서를 읽게 한다.
- 근거 행을 누르면 원문, 문서 기준일, 해당 문장, 계산식이 중앙에 열린다.
- 승인 버튼은 실제 제출 내용과 금액을 문장으로 표시한다.
- 승인·반려 후 버튼을 즉시 비활성화하고 서버 상태가 확정될 때까지 진행 상태를 표시한다.

### 9.5 세부 화면

| 경로 | 중앙 화면 | 우측 인스펙터 |
|---|---|---|
| `/portfolio` | 자산 차트 + 보유종목 표 | 선택 종목 최신 판단 |
| `/companies/[code]` | 가격·재무 추이 + 공시 문서 | 투자 근거와 검증 |
| `/agents/runs/[id]` | 업무 타임라인 + 산출물 diff | 노드 상태와 오류 |
| `/approvals` | 승인 대기 고밀도 목록 | 선택 요청 승인 상세 |
| `/orders` | 주문·체결 표 | 주문 수명주기와 영수증 |
| `/reports/[id]` | 문서형 투자 리포트 | 근거·검증 탐색기 |
| `/settings/policy` | 투자 한도 폼 | 변경 영향 미리보기 |

### 9.6 반응형 규칙

- `>= 1280px`: 3열 전체 표시.
- `960~1279px`: 인스펙터를 토글 가능한 우측 패널로 전환.
- `720~959px`: 사이드바를 아이콘 열로 축소.
- `< 720px`: 조회 중심 단일 열. 주문 승인은 전체 화면 확인 단계를 추가한다.

데스크톱 경험이 우선이지만 승인 기능은 작은 화면에서도 정보가 생략되지 않아야 한다.

## 10. 프론트엔드 데이터 계약

- 화면에서 금액을 다시 계산하지 않는다. 서버가 원화 환산값과 계산 기준을 반환한다.
- 숫자 값과 표시 문자열을 분리한다: `{ value: 128450000, formatted: "128,450,000원" }`.
- 모든 비동기 화면에 `loading`, `empty`, `stale`, `error`, `permission_denied` 상태를 설계한다.
- 낙관적 업데이트는 사이드바 읽음 상태 등에만 사용한다. 승인과 주문은 서버 확정 후 반영한다.
- SSE 연결이 끊기면 마지막 이벤트 ID로 재연결하고 최종 상태를 REST로 재조회한다.

## 11. 보안과 실행 안전

- API 키와 계좌 비밀은 환경변수 원문이 아니라 운영 비밀 저장소 참조로 관리한다.
- 모의와 실전 환경은 서로 다른 자격증명, DB 스키마 또는 배포 환경으로 분리한다.
- 브라우저에는 브로커 토큰을 전달하지 않는다.
- 모든 변경 API에 인증, CSRF 방어, 요청 속도 제한을 적용한다.
- 주문 생성은 `Idempotency-Key`를 필수로 받는다.
- `proposal → verification → policy decision → approval → order` 해시 체인을 감사 로그에 저장한다.
- kill switch 활성화 중에는 신규 주문·승인을 금지하고, 체결 조회와 취소만 허용한다.
- 원본 감사 이벤트는 수정하지 않고 정정 이벤트를 추가한다.
- 로그에서 계좌번호, 토큰, 개인정보, 원문 프롬프트의 민감 내용을 마스킹한다.

## 12. 테스트 전략과 완료 기준

### 12.1 필수 테스트

- 계산 단위 테스트: 수익률, 평균단가, 실현·미실현손익, 수수료, MDD, 비중.
- 공시 정규화 테스트: 연결/별도, 누적/분기, 단위, 정정 공시.
- 정책 속성 테스트: 한도를 넘는 모든 주문은 자동 실행되지 않아야 함.
- 상태 전이 테스트: 검증 없는 주문, 만료 승인, 중복 주문이 불가능해야 함.
- 계약 테스트: 외부 API fixture와 실제 응답 스키마 차이 탐지.
- 에이전트 평가: 숫자 오류, 오래된 근거, 단위 오류를 주입한 고정 데이터셋.
- E2E: 분석 시작→검증→승인→모의체결→포트폴리오 갱신.
- 접근성: 키보드 탐색, 포커스, 색상 외 상태 표현, 스크린리더 라벨.

### 12.2 MVP 승인 조건

- 검증이 없거나 반려된 제안으로 주문을 생성할 수 없다.
- 같은 멱등키의 주문이 두 번 체결되지 않는다.
- 화면의 핵심 숫자에서 원본 출처와 기준 시각까지 2회 이내 동작으로 접근한다.
- 에이전트 재시작 후 승인 대기 지점에서 실행을 복구한다.
- 고정 fixture 기반 포트폴리오 손익이 기대값과 정확히 일치한다.
- 1440×900 화면에서 3열 레이아웃이 스크롤 충돌 없이 동작한다.
- 라이트·다크 모드와 960px 축소 화면에서 핵심 승인 정보가 누락되지 않는다.

## 13. 구현 순서

### Sprint 0 — 기반과 화면 골격

- 모노레포, Next.js, FastAPI, PostgreSQL, Redis 구성.
- 공통 도메인 enum과 OpenAPI 생성 파이프라인 구성.
- macOS 앱 셸, 소스 리스트, 중앙 작업면, 인스펙터 구현.
- fixture 데이터로 투자 운영 화면을 완성한다.

**산출물:** 실제 데이터를 닮은 고정 데이터로 동작하는 대시보드와 API 스텁.

### Sprint 1 — 포트폴리오와 결정적 계산

- instruments, portfolios, positions, price snapshots 스키마.
- 손익·성과·MDD·비중 계산 모듈과 단위 테스트.
- 대시보드 summary/performance/positions API.
- 차트와 보유종목 선택 연동.

**산출물:** 재현 가능한 포트폴리오 대시보드.

### Sprint 2 — 공시와 근거

- OpenDART 어댑터, 원문 저장, 재무 계정 정규화.
- evidence item과 출처 탐색 UI.
- 기업 상세 화면과 재무 추이.

**산출물:** 모든 핵심 재무 수치가 공시 근거로 연결된 기업 분석 화면.

### Sprint 3 — 분석·검증 에이전트

- LangGraph 상태와 PostgreSQL 체크포인터.
- 투자 제안·검증 Pydantic 스키마.
- 결정적 계산 검사와 LLM 검증 조합.
- 실행 타임라인, 제안 diff, 검증 인스펙터.

**산출물:** 수정 루프와 합의 실패를 포함한 분석→검증 흐름.

### Sprint 4 — 정책·승인·모의실행

- 정책 엔진과 승인 등급 판정.
- 승인 토큰, 만료, 가격 가드, kill switch.
- 내부 PaperBroker와 주문 상태 수명주기.
- 승인 대기·주문·체결 화면과 E2E 테스트.

**산출물:** 검증된 제안만 안전하게 모의체결되는 폐쇄 루프.

### Sprint 5 — 공식 모의투자와 리포트

- 한국투자증권 모의투자 어댑터와 상태 조정.
- 재시도·호출 한도·체결 reconciliation.
- 주간 웹 리포트와 근거 탐색.
- 운영 관측, 오류 알림, 실행 runbook.

**산출물:** 외부 모의 계좌와 일치하는 포트폴리오 및 감사 가능한 리포트.

## 14. 첫 구현 티켓

다음 순서로 바로 개발을 시작한다.

1. `apps/web`, `apps/api`, `packages` 모노레포 골격 생성.
2. 공통 디자인 토큰과 3열 `MacAppShell` 구현.
3. fixture 기반 `GET /v1/dashboard/summary`, `performance`, `positions` 구현.
4. 투자 운영 화면의 자산 차트와 보유종목 표 구현.
5. 우측 `AgentInspector`에 분석·검증·승인 상태 구현.
6. Playwright로 1440×900 스크린샷 회귀 테스트 추가.
7. PostgreSQL 마이그레이션과 fixture seed를 연결.

첫 수직 슬라이스는 외부 API보다 UI와 내부 데이터 계약을 먼저 고정한다. 이후 OpenDART와 모의 브로커를 어댑터로 교체해도 화면과 도메인 계약이 바뀌지 않게 한다.

## 15. 결정이 필요한 후속 항목

다음 선택은 Sprint 0 진행을 막지 않으며, 해당 연동 직전에 확정한다.

- LLM 공급자와 데이터 보존 정책.
- 한국투자증권 모의투자 계정 사용 여부와 키 준비 시점.
- 뉴스 데이터 공급자와 상업적 이용 범위.
- 팀 배포 환경(Vercel+컨테이너, 단일 클라우드, 온프레미스).
- 최종 사용자가 개인 투자자인지 내부 연구팀인지에 따른 인증·규제 범위.
