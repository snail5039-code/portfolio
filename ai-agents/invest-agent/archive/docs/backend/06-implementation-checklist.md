# 백엔드 구현 체크리스트

기준일: 2026-08-29 KST

## BACKEND-002 완료 항목

- `apps/api` FastAPI 최소 골격 생성 완료
- `GET /api/health` 단독 엔드포인트 생성 완료
- health 평면 JSON 응답 스키마 생성 완료
- 응답에 `status`, `service`, `generatedAt`, `dataAsOf`, `sourceLabel`, `isMock`, `paperOnly`, `externalConnections`, `executed`, `disclaimer` 포함
- `uv run pytest` 기준 백엔드 테스트 2개 통과
- `/api/dashboard` 미구현 및 404 기대 상태 확인
- 검증자 20세대 `BACKEND-002-V` 통과

## BACKEND-003 완료 항목

- `GET /api/dashboard` 구현 완료
- `FixtureEnvelope` 공통 안전 봉투 도입, 안전 플래그를 `Literal`로 강제
- 금액 정수·비율 퍼센트 단위 숫자 계약 확정, 응답에서 포맷 문자열 제거
- 해당 없는 값을 `"-"` 대신 `null`로 표현
- CORS `allow_headers` 명시 목록화 (`BACKEND-CORS-001` 흡수)
- Vite `server.proxy`로 `/api` → `http://127.0.0.1:8000` 전달, 브라우저 절대 URL 호출 제거
- 프론트 `src/api/client.ts` 추가: `/api/` 상대 경로 전용, 응답 안전 필드 재확인
- 프론트 `src/lib/format.ts` 추가: 원본 숫자 → 화면 문자열
- `DashboardPage` 로딩·오류·재시도 상태 추가
- 프론트 `src/fixtures/dashboard.ts` 제거
- `uv run pytest` 9개 통과, `npm run typecheck`·`npm run build` 통과
- 1440×900 렌더링 회귀 확인, 콘솔 오류 없음, 모든 요청 호스트 `127.0.0.1:5173`

## BACKEND-004 완료 항목

- `GET /api/account` 구현 완료. 대시보드 fixture에서 유도한 값이라 두 화면이 어긋날 수 없음
- `GET /api/agents/{analysis|verification|execution}` 구현 완료. 세 단계가 한 스키마를 공유
- `AgentCapability.connected`를 `Literal[False]`로 강제해 연결됨 상태를 표현 불가로 만듦
- 실행 단계 `executionGrade`에서 `자동 실행` 배제, 전 항목 `실행 결과: 실행 안 됨`
- 프론트 `AccountPage`, `AgentStagePage`(3개 화면 공유) 추가
- 공통 `useFixture` 훅과 `renderFixtureFallback` 추가, `DashboardPage`도 이관
- `.loading-screen`/`.error-screen`을 `styles/global.css`로 이동
- React 네비게이션에서 누락돼 있던 「실행 에이전트」 항목 복구
- 테스트 9개에서 39개로 확장
- `uv run pytest` 39개 통과, `npm run typecheck`·`npm run build` 통과
- 4개 신규 화면 1440×900 렌더링 확인, 오버플로 0, 콘솔 오류 없음

## BACKEND-005 완료 항목

- `GET /api/approvals`, `POST /api/approvals/{id}/approve`, `POST /api/approvals/{id}/reject` 구현 완료
- 이 프로젝트 최초의 쓰기 경로. `ApprovalStore`가 메모리에 상태를 들고 `list()`/`get()`/`decide()` 세 메서드만 노출
- 스토어는 `create_app()`마다 새로 생성해 `app.state`에 저장. 모듈 전역 아님 — 테스트 간 상태 오염 없음
- `decisionStatus`는 `pending`/`approved`/`rejected` 세 값뿐. `executed`류 값은 스키마에 없음
- 이미 결정된 건 재결정 시 `409`, 모르는 ID는 `404`
- CORS `allow_methods`에 `POST` 추가
- 프론트 `ApprovalQueuePage`를 백엔드에 연결. `overrides` 맵으로 재요청 없이 즉시 반영
- `src/api/client.ts`에 `postFixtureAction()` 추가, FastAPI `detail` 메시지를 그대로 노출
- 프론트 `src/fixtures/approvals.ts` 제거
- 테스트 39개에서 49개로 확장
- `uv run pytest` 49개 통과, `npm run typecheck`·`npm run build` 통과
- 실제 클릭으로 승인·반려·새로고침 후 상태 유지·409 충돌을 브라우저에서 확인

## BACKEND-006 완료 항목

- `app/fixtures/decisions.py` 신규: DEC-1042의 정적 사실(회사·코드·구분·수량·가격)을 한 곳에 정의. `dashboard.py`와 `approvals.py`가 참조
- `app/schemas/common.py`에 `DecisionStatus` Literal을 한 번만 정의, `dashboard.py`·`approvals.py` 스키마가 공유
- `GET /api/dashboard`가 `Request`를 받아 승인 스토어에서 DEC-1042의 실시간 `decisionStatus`/`decidedAt`을 읽어옴
- 프론트 `DashboardPage`의 승인/반려 버튼을 실제 `approveOrder`/`rejectOrder` API로 교체. 기존에는 로컬 문자열만 바꾸는 가짜 두 번째 승인 UI였음
- `agents.py`의 NAVER "관찰 유지" 예시가 승인 대기의 실제 DEC-1043(NAVER 매도)과 정반대 내용으로 ID가 충돌하던 버그 발견, DEC-1057로 분리
- 대시보드↔승인 대기 교차 일관성 테스트 5개 추가 (같은 결정을 한쪽에서 승인하면 다른 쪽에도 즉시 반영되는지 검증)
- 테스트 49개에서 54개로 확장
- `uv run pytest` 54개 통과, `npm run typecheck`·`npm run build` 통과
- 브라우저에서 대시보드→승인, 승인 대기 화면 확인, 무관한 결정(NAVER 반려) 영향 없음, 검증 에이전트의 NAVER 항목이 더 이상 충돌하지 않음을 실제 클릭으로 확인
- 나머지 12개 프론트 전용 fixture의 결정 데이터는 통합하지 않음. 범위와 이유는 `10-decision-consolidation.md` 참조

## BACKEND-007 완료 항목

- 나머지 17개 화면(리스크 알림, 거래 내역, 포트폴리오 건강, 근거 패킷, 감사 로그, 결정 회고, 역할 상태,
  주간 리포트, 세금·수수료, 변경 비교, 전략 조정, 백테스트, 기업 상세, 데이터 연결, 알림 설정, 투자 정책,
  스트레스 테스트)를 전부 `GET` 엔드포인트로 이관. 쓰기 API는 추가하지 않음
- 프론트 `apps/web/src/fixtures/` 디렉터리 완전히 비움 (디렉터리 자체 삭제)
- 프론트 계산 함수(`getRebalanceProposals`, `getBacktestMetrics`/`Rows`, `getStressRows`, 주간 리포트
  함수형 필드)를 서버 사전 계산으로 이동. 모든 조합을 한 번에 계산해 응답에 포함
- `decisions.py`에 DEC-1043, DEC-1044 추가. `evidence_packets.py`가 DEC-1042 실시간 승인 상태를 반영
- `company_detail.py`가 삼성전자 보유 수치를 `build_dashboard_data()`에서 재사용
- 마이그레이션 중 React Hooks 순서 위반 런타임 크래시 발견 및 수정 (4개 페이지: TaxFeeImpactPage,
  DecisionReviewPage, AgentRoleStatusPage, PortfolioChangeComparePage). 조기 반환 아래 있던 `useEffect`를
  `useRef` 간접 참조로 조기 반환 위로 이동
- 테스트 54개에서 108개로 확장 (배치별 스냅샷: 54→69→81→93→108)
- `uv run pytest` 108개 통과, `npm run typecheck`·`npm run build` 통과
- 브라우저로 23개 화면 전부 순회, 1440×900 하단 잘림·오버플로 0, 에러 화면 0, 새 탭 콘솔 오류 0건 확인
- 알려진 낮은 우선순위 항목 2건은 `docs/backend/11-remaining-screens-migration.md`에 기록하고 남김

## 다음 구현자 체크리스트

- 작업 시작 전 `AGENTS.md`와 `docs/backend/00-readme.md`를 읽는다.
- 현재 Git 상태와 최신 커밋을 확인한다.
- 승인 흐름을 붙이면 메모리 저장소 범위와 `allow_methods`에 `POST` 추가 승인을 먼저 확인한다.
- 새 화면 API는 `docs/backend/07-dashboard-api.md`의 숫자 표현 규칙과 봉투 구조를 그대로 따른다.
- 외부 API, 실제 금융 데이터, 계좌, 주문, 체결, 운영 DB 연결 코드를 만들지 않는다.
- React 코드는 승인된 연결 범위가 없으면 수정하지 않는다.
- 커밋/푸시는 별도 지시가 있을 때만 수행한다.

## 문서 작업 자체 점검

- `docs/backend/00-readme.md`부터 `06-implementation-checklist.md`까지 7개 문서가 존재한다.
- 문서가 인덱스, 범위, fixture 계약, FastAPI 골격, health API, 안전 경계, 체크리스트로 나뉘어 있다.
- `docs/fullstack/*`의 장기 API 전체 목록을 복사하지 않고 참조만 둔다.
- 문서 갱신 작업에서는 FastAPI 코드, `apps/api`, 패키지, React 파일을 수정하지 않는다.
- `docs/fullstack/00-readme.md`가 백엔드 1단계 문서 위치를 안내한다.
- `docs/handoff/01-current-state.md`와 `docs/handoff/02-active-roles.md`가 현재 문서 단계와 공식 역할 최신 세대를 반영한다.

## 다음 검증자 체크리스트

- 문서 작업 검증 시 `docs/backend/` 7개 문서 존재와 분할 구조를 먼저 확인한다.
- 문서 작업 검증 시 FastAPI 코드, 패키지, React 변경이 없는지 확인한다.
- 백엔드 구현 검증 시 `apps/api` 외의 불필요한 코드 변경이 없는지 확인한다.
- `/api/health`가 HTTP 200과 JSON으로 응답하는지 확인한다.
- `isMock: true`, `paperOnly: true`, `externalConnections: 0`, `executed: false`가 응답에 있는지 확인한다.
- `/api/dashboard`가 HTTP 200 봉투 응답인지, 금액이 정수이고 포맷 문자열이 없는지 확인한다.
- 보유 종목 `value` 합계가 `summary.totalAsset`과 일치하는지 확인한다.
- 미구현 경로(`/api/approvals` 등)가 404인지 확인한다.
- 금지 문자열과 외부 URL 호출 코드가 없는지 검색한다.
- 실제 주문·체결·계좌·공시·시세·환율·운영 DB 연결이 없음을 확인한다.
- 테스트가 통과하는지 확인하고, 실행하지 못한 항목은 이유를 남긴다.

## 보고 형식

구현자는 완료 보고에 다음을 포함한다.

- 생성/수정 파일
- 구현한 엔드포인트와 응답 예시
- 사용한 fixture와 기준 시각
- 테스트 결과
- 금지 연결 문자열 점검 결과
- 남은 위험과 관리자 결정 필요 항목
