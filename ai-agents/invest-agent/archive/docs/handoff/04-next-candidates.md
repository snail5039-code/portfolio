# 다음 화면 후보

> 아래 4·5·6번(FRONTEND-006/007 관련 서술)은 이제 실제로 커밋·푸시됐다(`71918cc`, `804606a`) — 한동안 "완료했지만 미커밋" 경고가 여기 남아 있었는데 stale했던 것이니 무시한다. 현재 커밋 상태는 `docs/handoff/01-current-state.md`의 "커밋 상태" 절을 본다.

다음 화면 작업 번호는 `MOCKUP-020`이다. 다만 현재 판단은 새 화면 추가를 멈추고 `FINANCIAL_AI_FULLSTACK_PLAN.md`와 `docs/fullstack/00-readme.md` 기준으로 프론트엔드·백엔드 연결 앱 전환을 이어가는 것이다. `MOCKUP-015` 세금·수수료 영향 점검, `MOCKUP-016` 사용자 승인 이력·결정 회고, `MOCKUP-017` 에이전트별 역할 상태판, `MOCKUP-018` 포트폴리오 변경 전/후 비교, `MOCKUP-019` 승인 전 근거 패킷은 완료됐다. React/Vite `apps/web`에는 정적 목업 19개에 대응하는 19개 화면 이전이 완료됐고, `FRONTEND-FINAL-AUDIT-R1-V`에서 최종 회귀 `통과` 판정을 받았다.

## 완료: 세금·수수료 영향 점검

- 목적: 매수·매도 제안 전 수수료, 세금, 슬리피지, 예상 순손익이 어떻게 달라지는지 화면용으로 점검한다.
- 완료 파일: `tax-fee-impact.html`, `tax-fee-impact.css`, `tax-fee-impact.js`, `tax-fee-impact-1440x900.png`
- 검증: `MOCKUP-015-V` 대체 독립 검증 조건부 통과 후 README R1 재검증 `통과`
- 안전 경계:
  - 화면 검토용 가상 예시
  - 실제 세금 계산 아님
  - 실제 주문 아님
  - 실제 계좌·API·DB 미연결

## 완료: 사용자 승인 이력·결정 회고

- 목적: 사용자가 왜 승인·반려했는지, 이후 가상 결과가 어땠는지 돌아본다.
- 완료 파일: `decision-review.html`, `decision-review.css`, `decision-review.js`, `decision-review-1440x900.png`
- 검증: `MOCKUP-016-V` 대체 독립 검증 실패 후 R1 재검증 `통과`
- 안전 경계:
  - 실제 성과 회고 아님
  - 투자 판단 평가나 권유 아님
  - 화면용 가상 결과

## 완료: 에이전트별 역할 상태판

- 목적: 제안자, 검증자, 정책 감시자, 승인 관리자 등 역할이 현재 어떤 상태인지 보여준다.
- 완료 파일: `agent-role-status.html`, `agent-role-status.css`, `agent-role-status.js`, `agent-role-status-1440x900.png`
- 검증: `MOCKUP-017-V` 대체 독립 검증 `통과`
- 안전 경계:
  - 실제 AI 실행 상태 아님
  - 외부 에이전트·API 연결 없음
  - 사용자의 승인 없이 어떤 금융 행동도 하지 않음

## 완료: 포트폴리오 변경 전/후 비교

- 목적: 리밸런싱이나 승인 전후의 가상 포트폴리오 변화를 비교한다.
- 완료 파일: `portfolio-change-compare.html`, `portfolio-change-compare.css`, `portfolio-change-compare.js`, `portfolio-change-compare-1440x900.png`
- 검증: `MOCKUP-018-V` 대체 독립 검증 `통과`
- 안전 경계:
  - 변경 후 수치는 실제 체결 결과 아님
  - 실제 주문 생성 아님
  - 손실 회피나 수익 개선 보장 아님

## 완료: 승인 전 근거 패킷

- 목적: 승인 전 결정 후보의 계산 재현성, 정책 한도, 비용, 출처, 리스크, 역할 확인, 사용자 승인 경계를 한 묶음으로 점검한다.
- 구현 파일: `evidence-packet.html`, `evidence-packet.css`, `evidence-packet.js`, `evidence-packet-1440x900.png`
- 검증: `MOCKUP-019-V` 대체 독립 검증 `통과`
- 안전 경계:
  - 화면 검토용 가상 근거 패킷
  - 실제 투자 권유·주문·체결 아님
  - 실제 공시·시세·계좌 검증 아님
  - 사용자 승인 전 금융 행동 없음

## 추천

`MOCKUP-020` 후보는 아직 새로 확정하지 않았다. 화면 추가가 다시 필요해질 때만 완료 화면 19개와 현재 사용자 흐름을 보고 새 후보를 정리한다. 현재 우선순위는 새 화면이 아니라 `BACKEND-002`로 생성된 `apps/api` 최소 골격과 `GET /api/health`를 유지하면서 후속 백엔드 범위를 작게 분리하는 것이다. 운영 DB는 계속 연결하지 않는다. 실제 금융 데이터·API·계좌·주문·체결은 원칙적으로 계속 연결하지 않되, OpenDART 공시 조회(읽기 전용)와 KIS 모의투자(가상계좌, 실제 자금 무관)는 각각 명시적 사용자 승인을 거친 좁은 예외다 — 둘 다 실제 자금이나 실전 계좌와는 무관하다.

## 다음 우선순위

`BACKEND-CORS-001`, `BACKEND-003`, `BACKEND-004`, `BACKEND-005`는 완료됐다. 대시보드·계좌·분석 에이전트·검증 에이전트·실행 에이전트·승인 대기 6개 화면이 백엔드에만 의존한다. React 화면은 23개다.

사이드바에 메뉴만 있고 화면이 없던 항목은 이제 없다.

`BACKEND-006`에서 결정(DEC) 데이터 통합 1차를 완료했다. `BACKEND-007`에서 나머지 17개 화면을 전부 백엔드로 옮겨 **23개 화면 전체가 백엔드에 연결**됐다. `apps/web/src/fixtures/`는 완전히 비었다.

## 다음 우선순위

1. ~~OpenAPI에서 TypeScript 타입 생성 도입.~~ `FRONTEND-006`에서 완료. `npm run generate:types`가 `apps/api`의 OpenAPI 스키마에서 `src/types/api.generated.ts`를 만들고, `types/dashboard.ts`는 이제 그 별칭 중심이다. 백엔드 응답 모양이 바뀌면 이 스크립트를 다시 돌려야 한다.
2. ~~Playwright 핵심 흐름 테스트.~~ `FRONTEND-007`에서 완료, `FRONTEND-010`에서 커버리지를 넓혔다. `apps/web/e2e/`에 대시보드 로드·사이드바 내비게이션·승인 대기 승인/반려 3개(깊은 검증)에 더해, 23개 화면 전부를 순회하며 에러 화면·JS 예외가 없는지만 얕게 확인하는 회귀 스윕 1개(`all-screens-load.spec.ts`)를 추가했다. `npm run test:e2e`로 실행, 연속 3회 실행해 안정성 확인.
3. ~~사이드바 「승인 대기 4」 배지가 하드코딩이다.~~ `FRONTEND-006`에서 완료. `GET /api/approvals`의 실제 `pending` 개수를 쓴다.
4. 16개 결정 ID 전체의 서사 대조를 완료했다(`docs/backend/12-full-decision-id-audit.md`). BACKEND-006에서 절반만 고쳐졌던 DEC-1043 충돌과 `decision_review.py`의 DEC-1042·1044 충돌을 추가로 발견해 고쳤다. `trade_history`/`weekly_report`/`risk_alerts`의 DEC-1042 재사용은 동시 모순이 아니라고 확인해 남겨뒀다.
5. ~~`decision.expiresAt`이 `dataAsOf`보다 이른 문제.~~ `FRONTEND-008`에서 완료. 승인 대기 4건 전부가 이 문제였다(DEC-1042~1045 전부 `dataAsOf`보다 이른 만료 시각). 상대 순서·간격은 유지한 채 4개 전부 +1시간씩 밀었다. 대시보드·승인 대기 두 화면의 워크플로 3단계가 하드코딩된 `14:28`/"대기"만 보여주고 실제 `decidedAt`을 반영하지 않던 것도 같이 고쳤다. 상세는 `01-current-state.md` 참고.
6. ~~`linkPage`/`page` 필드 타입 불일치.~~ `FRONTEND-009`에서 완료. `HealthCheck.linkPage`만 `Literal`이고 `AgentWorkItem`/`TaxFeeOrder`/`DecisionReviewItem`/`AgentRoleStatusItem`/`RiskEvent`/`TradeRelatedLink`는 `str`이던 것을, 실제 fixture에서 쓰는 값만 모아 각 스키마 파일에 전용 `Literal`(`AgentWorkItemLinkPage` 등)을 새로 만들어 좁혔다. 덕분에 `types/dashboard.ts`에 있던 `Api<T, {linkPage: PageKey}>` 오버라이드 6곳이 전부 필요 없어져서 지웠다(352줄로 더 줄었다). 앞으로 이 필드들에 오타를 넣으면 프론트가 아니라 백엔드 스키마 검증에서 바로 걸린다.
7. ~~`types/dashboard.ts`는 이제 352줄이다(원래 1112줄)... 더 쪼갤지는 다음에 파일이 다시 커질 때 판단한다.~~ 2026-09-02, 사용자 요청으로 쪼갰다. 화면별로 `types/<screen>.ts`(예: `policySettings.ts`, `dashboardScreen.ts`) 21개 파일로 나누고, `dashboard.ts`는 전부 `export *`로 재수출하는 37줄짜리 배럴(barrel)만 남겼다. 기존 ~150곳의 `from "../types/dashboard"` import는 전부 그대로 동작한다(껍데기만 바뀌었으니 손댈 필요 없음). `types/common.ts`(81줄)에 `Api`/`Data`/`FixtureEnvelope`/`PageKey` 등 공유 유틸리티를 모았다. `npm run typecheck`·`build` 통과, 빌드 산출물 해시가 리팩터링 전후로 완전히 동일해 런타임 동작 무변화를 확인했다.
8. ~~`ApprovalStore`가 메모리 딕셔너리라 서버 재시작 시 승인 이력이 소실된다.~~ `FRONTEND-011`에서 SQLite로 전환했다. 결정 4건의 사실(fixture)은 그대로 두고, 실제로 바뀌는 값(`decisionStatus`/`decidedAt`)만 `apps/api/data/approvals.db`에 저장한다. 재시작해도 승인 이력이 유지되는 것을 직접 확인했다. 테스트는 여전히 `:memory:`(기본값)라 서로도, 실제 DB와도 격리된다.
9. `FRONTEND-012`에서 기업 상세 화면의 공시를 OpenDART 실제 API에 연결했다(이 프로젝트 최초의 실제 외부 API 연결, 사용자 요청). 2026-09-01에 사용자가 `OPENDART_API_KEY`를 발급받아 `apps/api/.env`에 채우고 처음으로 라이브 호출을 확인했다. 그 과정에서 `list.json` 날짜 범위(`bgn_de`/`end_de`) 누락 버그를 발견해 고쳤다(`d511cee`, 상세는 `01-current-state.md`). 브라우저에서 실제 공시가 뜨는 것까지 확인 완료. 상세 설계·타협점(`externalConnections` 스키마 완화 포함)은 `01-current-state.md` 참고.
10. 2026-09-02, 한국투자증권(KIS) **모의투자(paper trading)** API 연동 골격을 완성했다(이 프로젝트 최초의 "주문 실행" 경로, 사용자 요청). `app/integrations/kis.py`(토큰 발급·잔고조회·현재가·모의투자 매수/매도 주문), 대시보드 보유종목 실시간 연동, 승인 대기의 "승인" 시 실제 모의투자 주문 전송까지 배관을 전부 만들고 mock으로 검증했다(백엔드 134개 통과, `kis.py` 자체 요청 형태까지 직접 테스트). **`KIS_PAPER_APP_KEY`/`KIS_PAPER_APP_SECRET`/`KIS_PAPER_CANO`/`KIS_PAPER_ACNT_PRDT_CD` 발급은 사용자가 차후로 미뤘다**(삼성증권을 쓰고 있어서 KIS 계정이 없음) — `apps/api/.env`에 이 값들이 아직 없어서 실제 라이브 호출은 한 번도 안 해봤다. 키를 준비하면(README.md의 준비물 목록 참고) `apps/api/.env`에 채우고, 백엔드 재시작 후 대시보드 실제 잔고와 승인 시 실제 모의투자 주문 전송을 브라우저로 한 번 확인해야 한다 — OpenDART 때 `bgn_de` 날짜범위 버그처럼 mock 테스트로는 못 잡는 문제가 있을 수 있다. 상세 설계(실전 도메인/tr_id 구조적 차단, `executed`/`externalConnections` 의미 확장, KIS 주문 실패 시 승인 자체를 502로 실패시키는 이유)는 `01-current-state.md` 참고.
