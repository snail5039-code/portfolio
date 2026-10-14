# 현재 상태 요약

> **2026-10-03 방향 전환**: 이 저장소를 자연어 투자 에이전트(KB증권 API, Flutter 앱·웹, PostgreSQL)로 확장하기로 했다. 새 기준 문서는 루트의 [`INVEST_AGENT_PLAN.md`](../../INVEST_AGENT_PLAN.md)와 [`AGENTS.md`](../../AGENTS.md)다. 아래 내용은 그 이전(목업·fixture 단계) 기록이다.

기준일: 2026-09-02 KST

## 커밋 상태 (2026-09-01 갱신)

`FRONTEND-006`~`FRONTEND-012`는 모두 완료·커밋·푸시됐다(`71918cc`, `804606a`). 이 문서와 `04-next-candidates.md`에 한동안 "미커밋 작업 있음" 경고가 남아 있었는데, 그 경고가 가리키던 커밋들이 실제로 들어간 뒤에도 갱신되지 않아 stale했던 것이다 — 지금 이 절로 대체한다.

같은 날 사용자가 `apps/api/.env`에 실제 `OPENDART_API_KEY`를 발급받아 채웠고, 라이브 호출을 처음으로 실행해 확인하는 과정에서 실제 버그를 하나 발견해 고쳤다(`d511cee`, 로컬에만 있고 아직 원격에 푸시 안 함):

- `app/integrations/opendart.py`의 `fetch_recent_disclosures`가 `list.json` 호출 시 `bgn_de`/`end_de`(검색 날짜 범위)를 넘기지 않고 있었다. OpenDART는 이 값이 없으면 "전체 기간"이 아니라 빈 결과(`status: "013"`)를 돌려준다 — 그래서 실제 키가 유효해도 항상 조용히 fixture로 폴백되고 있었다(mock 테스트만으론 못 잡던 문제). 최근 1년 범위를 명시하도록 고쳤다.
- `test_envelope_carries_safety_flags`가 "테스트 환경에 키 없음"을 가정하고 있었는데, 로컬 `.env`에 실키가 생기자 `config.py`가 그걸 그대로 로드해 테스트가 실제로 라이브 API를 호출해버려 깨졌다. 다른 테스트들처럼 `OPENDART_API_KEY`를 명시적으로 `None`으로 monkeypatch해 격리했다.

**검증 완료**: 백엔드 `apps/api/.venv/Scripts/python.exe -m pytest -q` 113개 통과. 브라우저로 기업 상세 화면을 직접 열어 "OpenDART 실제 공시 연결" 배지와 삼성전자 실제 공시 3건(대규모기업집단현황공시 등, 2026.08.28~31 접수)이 정상 렌더링되는 것을 확인했다.

## 2026-09-02: 투자 정책·알림 설정 "가상 적용"을 SQLite에 저장

두 화면 모두 원래 `app/fixtures/policy_settings.py`·`notification_settings.py` 코드 주석에 "저장되지 않는 화면 상태(by design)"라고 명시돼 있었다 — 편집·적용이 순전히 프론트엔드 로컬 상태였다. 사용자가 명시적으로 "저장도, 모의도 해야 한다"고 방향을 뒤집어서, 승인 저장소(`ApprovalStore`)와 같은 패턴으로 SQLite 저장을 추가했다. 여전히 완전히 paper/demo 상태다 — 실제 주문·계좌·정책 엔진에는 아무 영향이 없다.

- 신규 `app/store/policy_settings.py`(`PolicySettingsStore`), `app/store/notification_settings.py`(`NotificationSettingsStore`) — `ApprovalStore`와 동일하게 `db_path=":memory:"` 기본값(테스트 격리), `app/main.py`가 실제 파일 경로(`apps/api/data/policy_settings.db`·`notification_settings.db`, `.gitignore`의 `apps/api/data/`에 이미 포함)를 넘긴다.
- `POST /api/policy-settings/apply`: 6개 숫자 규칙 + 4개 체크박스를 저장. 서버가 각 규칙의 min/max로 재검증해 범위를 벗어나면 422(클라이언트 검증을 신뢰하지 않고 영구 저장 전에 한 번 더 막는다).
- `POST /api/notification-settings/apply`: 6개 알림 유형 enabled + `defaultSeverity`만 저장. 채널(`channels`)은 화면에 토글 컨트롤이 없어서(브라우저 권한 요청·이메일/메신저 연결처럼 실제로 연결하지 않는 것들이라 일부러 안 만듦) 저장 대상에서 제외했다.
- 두 `PolicySettingsData`/`NotificationSettingsData`에 `appliedAt: str | None` 필드 추가 — 저장 이력이 없으면 `null`, 저장되면 그 시각. `GET`이 저장된 값을 fixture 기본값 위에 덮어써서 응답하므로 재시작해도 마지막 저장 상태가 그대로 보인다.
- 두 화면의 `POLICY_SETTINGS_DISCLAIMER`/`NOTIFICATION_SETTINGS_DISCLAIMER` 문구가 예전엔 "정책 저장 없음"/"계좌·API·DB 미연결"이라고 저장 자체를 부정하고 있어서, 이제 저장은 하되 실제 계좌·주문·외부 API와는 무관하다는 쪽으로 정직하게 고쳤다.
- 프론트: `PolicySettingsPage.tsx`의 "가상 정책 적용" 버튼과 `NotificationSettingsPage.tsx`에 새로 추가한 "유형·심각도 설정 저장" 버튼이 각각 `POST .../apply`를 호출하고, 저장 시각을 "가상 적용됨 · 서버에 저장됨 (HH:MM, 재시작해도 유지)" 식으로 표시한다. `api/client.ts`에 JSON 바디를 보내는 `postFixture` 헬퍼를 추가했다(기존 `postFixtureAction`은 바디 없는 POST 전용).
- `apps/web/playwright.config.ts`가 새 두 스토어의 `*_DB_PATH` 환경변수도 `:memory:`로 오버라이드하도록 갱신(승인 저장소와 동일한 이유 — e2e 실행끼리 상태가 새면 안 됨).
- 검증: 백엔드 `pytest` 121개 통과(신규 10개: 저장/재조회/범위초과 422/타입 누락 422/앱 인스턴스 간 격리). 프론트 `typecheck`·`build`·`test:e2e`(5개) 통과. 브라우저로 직접 두 화면 모두 값 변경 → 저장 → 전체 새로고침 → 값 유지 확인, 이어서 실제 API 서버(8000)를 완전히 재시작해 `apps/api/data/policy_settings.db`·`notification_settings.db` 파일 기반으로도 유지되는 것까지 확인했다.

### 후속: 알림 채널(브라우저/이메일/메신저)도 가상 활성화 가능하게 확장

바로 위 항목은 "채널은 편집 UI가 없어서 저장 대상에서 제외했다"고 적었는데, 사용자가 바로 이어서 이것도 열어달라고 요청했다. 안전 경계와 충돌하지 않는 방식으로 구현했다: `enabled`는 순수 가상 토글일 뿐이고, 각 채널의 `state`/`summary`(예: "권한 요청 없음", "메일 서버와 계정은 연결하지 않았습니다")는 fixture 고정값이라 토글 여부와 무관하게 절대 안 바뀐다 — 그래서 브라우저 채널을 "켜짐"으로 저장해도 실제 브라우저 알림 권한 요청이나 이메일/메신저 연결은 여전히 전혀 일어나지 않는다.

- `NotificationApplyRequest`에 `channels: dict[NotificationChannelId, bool]` 추가(4개 키 전부 필수, 없으면 422). `NotificationSettingsStore`에 채널 4개 컬럼 추가.
- 라우터가 저장된 `enabled`만 덮어쓰고 `name`/`state`/`summary`는 항상 fixture 그대로 응답.
- 프론트: 채널 카드에 활성 여부를 나타내는 작은 점(dot) 표시 추가, 인스펙터의 "가상 활성화" 행이 이제 켜짐/꺼짐 토글 버튼. 저장 버튼 라벨을 "채널·유형·심각도 설정 저장"으로 변경.
- 검증: 백엔드 `pytest` 121개(채널 저장/누락 422 테스트로 교체, 순 증감 0). 프론트 `typecheck`·`build`·`test:e2e`(5개) 통과. 브라우저로 브라우저 채널을 켜짐으로 저장 → 새로고침 → 유지 확인, 이어서 실제 서버 재시작으로 SQLite 파일 기반 유지까지 확인. 이 스키마 변경으로 기존 `apps/api/data/notification_settings.db`(컬럼 없음)가 호환 깨져서 로컬에서 삭제하고 새로 만들게 했다 — 이 파일은 매 세션 로컬 생성물이라 커밋 대상이 아니다.

## 2026-09-02: 한국투자증권(KIS) 모의투자 API 연동 — 이 프로젝트 최초의 "실제 주문 실행" 경로

사용자가 "AI가 제안하면 승인 눌러서 실제로 살 수 있게" 만들자고 요청했다. 실제 계좌·실제 자금으로 매수·매도를 실행하는 기능은 명확히 거절했다(Anthropic 운영 규칙·이 프로젝트 `AGENTS.md` 둘 다 위반) — 대신 최초 기획 문서 `FINANCIAL_AI_AGENT_IDEA.md`의 4단계("실행 에이전트": "증권사 **모의투자** API 연동")를 재확인하고, 한국투자증권(KIS) Developers의 **모의투자(paper trading)** API로 시작했다. 실제 서버·실제 인증·실제 주문 흐름이지만 KIS 자신이 관리하는 가상계좌라 실제 자금은 전혀 움직이지 않는다. 사용자는 아직 KIS 키를 발급받지 않았다(삼성증권 사용 중 — 삼성증권은 개인 개발자에게 API를 안 열어줘서 KIS로 결정) — 이번 세션은 그 키가 없어도 전부 mock으로 검증 가능한 "골격"까지다.

- 신규 `app/integrations/kis.py`: OAuth 토큰 발급·캐싱(1일 유효, 만료 5분 전 자동 갱신), 잔고조회(`inquire-balance`, tr_id `VTTC8434R`), 현재가 조회(`inquire-price`, tr_id `FHKST01010100`), 모의투자 매수·매도 주문(`order-cash`, tr_id `VTTC0012U`/`VTTC0011U`). **실전투자 도메인(`openapi.koreainvestment.com`)과 그 tr_id(`T`/`J`/`C`로 시작)는 이 파일에 코드로도 존재하지 않는다** — 구조적으로 실전 주문을 낼 수 없다. 엔드포인트 사양은 KIS 공식 GitHub([koreainvestment/open-trading-api](https://github.com/koreainvestment/open-trading-api))에서 직접 확인했다.
- 신규 `app/config.py`의 `KIS_PAPER_APP_KEY`/`KIS_PAPER_APP_SECRET`/`KIS_PAPER_CANO`/`KIS_PAPER_ACNT_PRDT_CD` — 넷 중 하나라도 비면 기존과 동일하게 fixture로 동작(OpenDART와 같은 폴백 원칙).
- `app/routers/dashboard.py`: KIS가 설정돼 있으면 `holdings`를 실제 모의투자 잔고로 교체(`holdingsConnected: true`). 그 외(차트, AI 판단 근거)는 여전히 fixture. `DashboardData.holdingsConnected`, `DashboardDecision.kisOrderNo` 필드 신규.
- `app/routers/approvals.py`: KIS가 설정돼 있으면 "승인"이 실제로 `place_paper_order`를 호출해 그 가상계좌로 지정가 주문을 전송하고, 성공하면 KIS의 진짜 주문번호(`ODNO`)를 `ApprovalOrder.kisOrderNo`에 저장한다. **주문 전송이 실패하면 승인 자체를 502로 실패시킨다** — OpenDART처럼 조용히 fixture로 폴백하지 않는다("승인 = 실제로 KIS에 주문이 나갔다"는 의미가 깨지면 안 되기 때문. 성공/실패의 의미가 OpenDART와 다르다는 점에 유의). 반려는 side effect 없이 언제나 로컬 상태만 바꾼다(승인만 주문을 낸다).
- `app/schemas/common.py`의 `FixtureEnvelope` 독스트링을 갱신: `executed: false`는 KIS 모의투자로 실제 주문이 나간 뒤에도 유지된다 — 그 계좌가 가상계좌라서 그런 것이지 주문이 안 나가서가 아니라는 점을 명시했다. `externalConnections`는 대시보드/승인 대기도 (OpenDART처럼) `1`을 보고할 수 있게 확장.
- 프론트: `assertFixtureEnvelope`에 대시보드·승인 대기용 `[0, 1]` 허용 추가(`getDashboard`/`getApprovals`/`approveOrder`). **`api/client.ts`의 기존 버그를 하나 고쳤다**: 5xx 응답은 무조건 "백엔드 응답 없음"으로 뭉뚱그려 FastAPI의 진짜 `detail`(예: KIS 502 사유)을 숨기고 있었다 — 이제 상태 코드와 무관하게 `detail`이 있으면 그걸 먼저 보여준다. `DashboardPage.tsx`/`ApprovalQueuePage.tsx`의 "실제 주문은 생성되지 않습니다" 고정 문구를 `kisOrderNo` 유무에 따라 정직하게 바꿨다.
- 안전 문서 갱신: `docs/fullstack/05-safety-validation.md`의 금지 문자열 목록에서 "KIS"/"Broker"/"real order"를 무조건 금지 문자열로 두던 것을, "실전투자 도메인·tr_id만 금지"로 정밀화했다(이 프로젝트가 이제 정당하게 "KIS"라는 이름을 코드·문서에 쓰기 때문). `00-readme.md`, `04-frontend-backend-scope.md`, 루트 `README.md`의 "실제 연결 안 함" 계열 문장에 KIS 모의투자 예외를 명시.
- 검증: 백엔드 `pytest` 134개(신규 13개: `kis.py` 자체의 요청 형태·tr_id 선택·토큰 캐싱을 `httpx.AsyncClient`를 가짜로 바꿔 직접 검증 5개 + 대시보드 KIS 오버레이 성공/실패/빈결과/kisOrderNo 전파 4개 + 승인 시 KIS 주문 성공/매도 tr_id/실패 시 502·pending 유지/반려는 KIS 호출 안 함 4개). 프론트 `typecheck`·`build`·`test:e2e`(5개) 통과. 브라우저로 KIS 미설정 상태에서 기존 승인 흐름이 그대로 동작하는 것(회귀 없음)까지 확인했다 — **실제 KIS 계정으로는 아직 한 번도 안 해봤다**(사용자가 아직 키가 없음).
- **다음 세션이 먼저 할 일**: 사용자가 한국투자증권 실계좌 개설 → 모의투자 참가신청 → [apiportal.koreainvestment.com](https://apiportal.koreainvestment.com/intro)에서 모의투자용 앱키/앱시크리트 발급 → 계좌번호(8+2자리) 확인 → `apps/api/.env`의 `KIS_PAPER_*` 4개 값을 채우면, 백엔드 재시작 후 대시보드 실제 잔고와 승인 시 실제 모의투자 주문 전송을 라이브로 한 번 확인해야 한다(OpenDART 때 `bgn_de` 버그처럼, mock 테스트로는 못 잡는 문제가 있을 가능성이 있다).

## 저장소 상태

- 원본 작업공간: `C:\Users\snail\OneDrive\바탕 화면\new_idea`
- 기본 브랜치: `main`
- 원격 저장소: `https://github.com/snail5039-code/financial-ai-agent`
- `origin/main`은 `f7efc52 핸드오프 문서의 stale한 커밋·OpenDART 키 상태 서술 갱신` 기준이다(그 아래 `d511cee`가 OpenDART 버그 수정 커밋). 위 "투자 정책·알림 설정 저장" 작업은 이 문서 기준 시점에 아직 커밋 전이다 — 커밋 여부는 사용자 지시로 진행한다.
- `MOCKUP-015` 세금·수수료 영향 점검 화면은 완료·검증·커밋·푸시했다.
- `MOCKUP-016` 사용자 승인 이력·결정 회고 화면도 완료·검증·커밋·푸시했다.
- `MOCKUP-017` 에이전트별 역할 상태판은 완료·검증·커밋·푸시했다.
- `MOCKUP-018` 포트폴리오 변경 전/후 비교 화면은 완료·검증·커밋·푸시했다.
- `MOCKUP-019` 승인 전 근거 패킷 화면은 완료·검증·커밋·푸시했다.
- `FRONTEND-005` 승인 대기 행 접근성 구조 정리는 `b654282`로 완료·검증·커밋·푸시했다.
- `GOVERNANCE-001` 역할 작업 가시성 운영 규칙 강화는 `93d9375`로 완료·검증·커밋·푸시했다.
- `SYNC-001` 원본 작업공간 인수 문서 동기화는 완료·검증·커밋·푸시했다.

## 현재 제품 상태

- `MOCKUP-019` 승인 전 근거 패킷 화면까지 구현했다.
- 총 19개 정적 화면과 각 1440×900 캡처가 있다.
- React/Vite 프론트엔드 `apps/web`에는 정적 목업 19개에 대응하는 19개 화면 이전이 완료됐다.
- 승인 대기 화면의 주문 행 접근성 구조는 `FRONTEND-005`에서 정리됐다.
- `FRONTEND-FINAL-AUDIT` 최초 검증은 1440×900 하단 잘림 문제로 `실패`였고, `FRONTEND-FINAL-AUDIT-R1` 재작업 후 검증자 19세대가 `FRONTEND-FINAL-AUDIT-R1-V`에서 `통과` 판정했다.
- FastAPI 백엔드는 `apps/api`에 있고, **23개 화면 전부**가 백엔드 엔드포인트에 연결됐다(`BACKEND-007`). 프론트 `apps/web/src/fixtures/`는 완전히 비었다.
- `BACKEND-005`에서 이 프로젝트 최초의 쓰기 경로(승인·반려)를 메모리 저장소로 구현했다. 승인 대기 화면은 이제 백엔드에 연결됐고 `src/fixtures/approvals.ts`는 제거했다.
- `BACKEND-003`에서 대시보드 수직 슬라이스를 완료했다. 대시보드 화면은 서버 응답만 사용하고 프론트 `src/fixtures/dashboard.ts`는 제거됐다.
- 프론트-백엔드 통신은 Vite `server.proxy`를 통한 같은 출처 상대 경로 `/api/*`다. 브라우저가 절대 URL을 호출하지 않는다.
- 응답 계약은 금액 정수·비율 퍼센트 단위 원본 숫자이고, 화면 문자열은 프론트 `src/lib/format.ts`가 만든다.
- `BACKEND-004`에서 계좌·분석 에이전트·검증 에이전트·실행 에이전트 4개 화면을 새로 만들어 백엔드에 연결했다. React 화면은 19개에서 23개가 됐다.
- 이 4개는 정적 목업에 대응 파일이 없다. 목업 사이드바에 `href="#"` 메뉴만 있었고 화면이 없었다. `FINANCIAL_AI_AGENT_IDEA.md` 역할 정의를 근거로 새로 설계했다.
- React 네비게이션에서 누락돼 있던 「실행 에이전트」 항목도 복구했다.
- 정적 목업은 19개 기준서로 동결한다. 새 화면은 React에만 추가한다.
- (`BACKEND-007` 이전 스냅샷: 당시 백엔드에 연결된 화면은 5개였다. 지금은 위에 적었듯 23개 전부다.)
- 실제 금융 데이터, 계좌, 주문, AI 실행, 외부 API, 운영 DB는 연결하지 않는다.

## 다음 작업

- `BACKEND-006`에서 결정 데이터 통합 1차를 완료했다. DEC-1042의 정적 사실과 실시간 승인 상태를 대시보드·승인 대기·에이전트 화면이 공유하고, 어느 화면에서 승인/반려해도 나머지가 즉시 반영된다.
- 이 작업 중 실제 콘텐츠 버그를 하나 발견해 고쳤다: `agents.py`의 검증 에이전트가 "NAVER 관찰 유지, 반려"라고 쓰던 항목이 승인 대기의 실제 "NAVER 매도 8주 대기중" 주문과 같은 DEC-1043 ID를 쓰고 있었다. 후자를 DEC-1057로 옮겨 분리했다.
- `BACKEND-007`에서 나머지 17개 화면(리스크 알림, 거래 내역, 포트폴리오 건강, 근거 패킷, 감사 로그, 결정 회고, 역할 상태, 주간 리포트, 세금·수수료, 변경 비교, 전략 조정, 백테스트, 기업 상세, 데이터 연결, 알림 설정, 투자 정책, 스트레스 테스트)를 전부 백엔드로 옮겼다. 모두 읽기 전용 `GET`이며 정책/알림 설정의 "가상 적용"은 여전히 저장되지 않는 화면 상태다.
- 이 과정에서 DEC-1043·DEC-1044도 `decisions.py` 공유 상수로 통합했고, `evidence_packets.py`가 DEC-1042 실시간 승인 상태를 반영하도록 새로 연결했다.
- 마이그레이션 중 실제 런타임 크래시를 하나 발견해 고쳤다: `TaxFeeImpactPage`, `DecisionReviewPage`, `AgentRoleStatusPage`, `PortfolioChangeComparePage` 4개 화면에서 조기 반환(로딩 중 return) 아래에 `useEffect`가 있어 React Hooks 순서 규칙을 위반하고 있었다. `useRef` 간접 참조로 고쳤다.
- 16개 결정 ID 전체의 서사 대조를 완료했다(`docs/backend/12-full-decision-id-audit.md`). BACKEND-006에서 절반만 고쳐졌던 DEC-1043 충돌(`agent_role_status.py` 2곳, `decision_review.py`)을 추가로 발견해 DEC-1057로 통일했고, `decision_review.py`가 갖고 있던 DEC-1042·DEC-1044 시점 충돌도 각각 DEC-1058·DEC-1059로 분리했다. 앞으로 같은 종류의 충돌을 잡는 회귀 테스트 2개를 추가했다(`test_no_row_contradicts_a_currently_pending_approval`, `test_no_role_claims_a_pending_decision_was_rejected`). `trade_history`/`weekly_report`/`risk_alerts`의 DEC-1042 재사용은 동시 모순이 아니라고 확인해 그대로 남겼다.
- 검증 방법 보완: 프록시 확인은 상태 코드만 보면 안 된다. Vite는 프록시가 꺼져 있어도 SPA fallback으로 200을 돌려주므로 `content-type`까지 확인한다.
- 화면 추가가 다시 필요해질 경우 다음 화면 번호는 `MOCKUP-020`이다.
- 현재 기본 추천은 새 화면 추가보다 React/Vite 19개 화면과 `GET /api/health`를 유지하면서 다음 백엔드 범위를 작게 분리하는 것이다.
- 풀스택 전환 계획은 루트 요약 문서와 `docs/fullstack/` 분할 문서로 나눴다.
- `BACKEND-CORS-001` CORS 헤더 명시화는 `BACKEND-003`에 흡수되어 완료됐다.
- 승인 흐름 착수 전 확정이 필요한 항목은 상태 저장소(메모리 vs SQLite)와 `allow_methods`에 `POST` 추가 시점이다.
- `FRONTEND-006`에서 `docs/backend/12-full-decision-id-audit.md`가 남긴 다음 우선순위 1·3번을 처리했다.
  - 사이드바 「승인 대기」 배지 하드코딩(`badge: "4"`)을 제거하고, `GET /api/approvals`의 실제 `pending` 개수를 쓰는 `useApprovalsPendingCount` 훅으로 바꿨다(`apps/web/src/lib/useApprovalsPendingCount.ts`). 승인/반려 호출이 `approvals:changed` 커스텀 이벤트를 쏘고, `AppShell`이 이를 구독해 같은 화면에서 승인해도 리페치 없이 즉시 갱신된다. 브라우저에서 승인 1건 후 배지가 4→3으로 바뀌는 것을 확인했다.
  - `apps/api`에 OpenAPI 스키마 export 스크립트(`scripts/export_openapi.py`)를 추가하고, `apps/web`에 `openapi-typescript`를 도입해 `npm run generate:types`(`apps/web/package.json`)로 `src/types/api.generated.ts`를 생성하도록 파이프라인을 연결했다. `types/dashboard.ts`(1112줄)를 이 생성 타입에 대한 별칭 중심으로 다시 썼고, 손으로 유지할 필요가 진짜로 있는 것만 남겼다: Dict 형태 응답 필드의 리터럴 키 유니언(OpenAPI의 `propertyNames.enum`이 코드젠에서 `{[key:string]:X}`로 뭉개짐), `linkPage`/`page`처럼 프론트 전용 `PageKey`를 가리키지만 백엔드 스키마엔 `string`으로만 잡히는 필드, 그리고 Pydantic 기본값 때문에 스키마에서 `?`가 붙는(실제로는 항상 내려오는) 필드의 옵셔널 제거(`Data<T>`/`Api<T,U>` 유틸리티). 결과적으로 파일이 1112줄→348줄로 줄었다. `npm run typecheck`·`npm run build` 통과, 백엔드 `pytest` 110개 통과, 브라우저로 백테스트·전략 조정·스트레스 테스트(Dict 타입 화면)와 리스크 알림→데이터 연결(`linkPage` 오버라이드) 이동을 직접 확인했다.
  - 이 과정에서 `types/dashboard.ts`에 실제로 있던 버그를 발견해 없앴다: `DecisionReviewItem`/`DecisionReviewData`, `AgentRoleStatusItem`/`AgentRoleStatusData`, `TaxFeeOrder`/`TaxFeeImpactData`, `PortfolioChangeAsset`/`PortfolioChangeCompareData`가 각각 두 번씩 선언돼 있었다(백엔드 연결 전 fixture 시절 타입이 지워지지 않고 남아 TS interface 병합으로 조용히 합쳐진 상태). 어느 페이지에서도 쓰지 않는 `PortfolioChangeFilter`/`TaxFeeImpactFilter`/`DecisionReviewFilter`/`AgentRoleStatusFilter`도 죽은 코드로 확인해 제거했다.
- `FRONTEND-007`에서 우선순위 2번(프론트 테스트 0개)을 처리했다. Playwright를 도입해(`apps/web/playwright.config.ts`, `apps/web/e2e/`) 핵심 흐름 3개를 커버했다: 대시보드 로드, 사이드바 내비게이션, 승인 대기 승인/반려(사이드바 배지·행 상태 전환 포함). 승인 저장소가 리셋 엔드포인트 없는 메모리 딕셔너리라는 점 때문에, 테스트는 개발자가 쓰는 8000/5173이 아니라 전용 포트(API 8010·웹 5174)에서 매 실행마다 새 FastAPI 프로세스로 뜨도록 구성했다(`vite.config.ts`의 `VITE_API_PORT`/`VITE_PORT` 지원). `npm run test:e2e`로 실행하며, 같은 스위트를 연달아 두 번 돌려 상태가 새지 않고 매번 통과하는 것을 확인했다.
- `FRONTEND-008`에서 `decision.expiresAt`이 `dataAsOf`보다 이르던 문제를 고쳤다. DEC-1042뿐 아니라 승인 대기 4건 전부(`DEC-1042`~`1045`)가 같은 문제였다 — 상대 순서·간격은 유지한 채 4개 전부 +1시간씩 밀었다. 대시보드·승인 대기 화면의 워크플로 3단계도 하드코딩된 `14:28`/"대기"만 보여주고 승인/반려 후에도 안 바뀌던 것을, 실제 `decision.decidedAt`을 반영하도록 고쳤다. 브라우저에서 승인 직후 "대기"→실제 승인 시각으로 바뀌는 것 확인. 백엔드 `pytest` 110개·프론트 `build` 통과.
- `FRONTEND-009`에서 `linkPage`/`page` 필드 타입 불일치를 고쳤다. `HealthCheck.linkPage`만 Pydantic `Literal`이고 `AgentWorkItem`/`TaxFeeOrder`/`DecisionReviewItem`/`AgentRoleStatusItem`/`RiskEvent`/`TradeRelatedLink`는 `str`이었다. 각 스키마 파일에 실제 fixture 값만 모은 전용 `Literal`(`AgentWorkItemLinkPage` 등)을 새로 만들어 좁혔다. 프론트에서 이 필드들을 `PageKey`로 좁히던 `Api<T, {linkPage: PageKey}>` 오버라이드 6곳이 이제 필요 없어져 `types/dashboard.ts`에서 지웠다(352줄). 백엔드 `pytest` 110개·프론트 `typecheck`/`build`/`test:e2e` 전부 통과.
- `FRONTEND-010`에서 Playwright 커버리지를 넓혔다. 기존 3개(대시보드·내비게이션·승인)는 깊은 흐름 검증이고, 나머지 20개 화면은 손으로 클릭해야만 회귀를 잡을 수 있었다. `e2e/all-screens-load.spec.ts`를 추가해 23개 화면 전부를 순회하며 `FixtureFallback`의 에러 화면과 uncaught JS 예외가 없는지만 얕게 확인한다. 화면별 세부 내용은 검증하지 않지만, "화면이 아예 안 뜬다"류의 회귀는 이제 전체 화면에서 잡힌다. 연속 3회 실행해 안정성 확인.
- `FRONTEND-011`에서 `ApprovalStore`를 SQLite로 전환했다(사용자가 Postgres 대안을 먼저 제안했으나, 로컬 단일 프로세스 데모에 외부 서비스 의존은 과하다고 판단해 SQLite로 확정). 4개 주문의 정적 사실(회사명·가격 등)은 그대로 `build_approval_orders()`에서 오고, 실제로 바뀌는 `decisionStatus`/`decidedAt`만 `approval_decisions` 테이블에 저장한다 — 재시작해도 결정이 없는 ID는 여전히 "pending"이라 재시딩이 필요 없는 구조. `ApprovalStore(db_path=":memory:")`가 기본값이라 `create_app()`을 인자 없이 호출하는 기존 21개 테스트 파일은 전혀 안 건드려도 격리가 유지된다. 실제 앱은 `app/main.py`가 `APPROVALS_DB_PATH` 환경변수(기본값 `apps/api/data/approvals.db`)로 실제 파일을 쓰고, Playwright e2e는 같은 변수를 `:memory:`로 오버라이드해 격리한다. FastAPI가 sync 라우터를 스레드풀에서 돌리는 점 때문에 `sqlite3.connect(..., check_same_thread=False)` + `threading.Lock`으로 접근을 직렬화했다. 브라우저로 DEC-1042 승인 후 서버를 완전히 재시작해 승인 상태가 유지되는 것, 나머지 3건은 그대로 pending인 것을 확인했다. 백엔드 `pytest` 110개(무변경), 프론트 `build`·`test:e2e`(연속 2회) 전부 통과.
- `FRONTEND-012`에서 이 프로젝트 최초로 실제 외부 API(금융감독원 OpenDART 공시 조회)를 연결했다. 사용자가 명시적으로 요청했고, 처음엔 "완전 자동 실거래"까지 논의가 갔으나 그건 별도로 거절했다(사람 승인 없는 실제 금융 거래 실행은 Anthropic 운영 규칙과 이 프로젝트의 `AGENTS.md` 둘 다에서 금지). OpenDART는 계좌·금액과 무관한 읽기 전용 공개 데이터라 이번 범위에 포함했다.
  - `app/config.py`(신규): `apps/api/.env`에서 `OPENDART_API_KEY`를 읽는다. `.env`는 git 미포함(`.env.example`만 커밋), 키는 사용자가 opendart.fss.or.kr에서 직접 무료 발급.
  - `app/integrations/opendart.py`(신규): `corpCode.xml`(종목코드→corp_code 매핑, 최초 1회 다운로드 후 `apps/api/data/`에 캐시)과 `list.json`(최근 공시 목록) 호출. `httpx.AsyncClient` 사용, 이 앱에서 실제 외부 URL을 호출하는 유일한 파일이다.
  - `app/routers/company_detail.py`: `OPENDART_API_KEY`가 설정돼 있고 호출이 성공하면 `filings`를 실제 공시로 교체하고 `filingsConnected: true`를 세팅. 키가 없거나 호출이 실패하면(네트워크 오류, rate limit, 빈 결과 등) 기존 fixture 플레이스홀더로 조용히 폴백 — 화면이 절대 깨지지 않는다.
  - **핵심 설계 충돌과 해결**: `FixtureEnvelope.externalConnections`가 `Literal[0]`으로 타입 자체에 박혀 있어서(주석: "실제 연결은 이 계약으로 아예 표현할 수 없도록") OpenDART가 실제로 연결돼도 정직하게 표시할 방법이 없었다. 프론트도 `externalConnections === 0`이 아니면 응답을 통째로 거부한다(`assertFixtureEnvelope`). 사용자에게 두 가지 선택지(스키마를 정직하게 고치기 vs `externalConnections`는 0 유지하고 `filingsConnected`로만 표시)를 제시했고, "스키마 고치기"로 확정했다. `externalConnections`를 `Literal[0]` → `int`로 바꾸고, 기업 상세만 연결 성공 시 `1`을 보낸다. 프론트 `assertFixtureEnvelope`에 허용 목록 파라미터를 추가해 기본값은 여전히 `[0]`(다른 22개 화면은 그대로 엄격), `getCompanyDetail`만 `[0, 1]`을 넘긴다.
  - 프론트 `CompanyDetailPage.tsx`의 하드코딩된 "OpenDART 미연결" 문구 4곳을 `filingsConnected` 기준 조건부로 바꿨다 — 안 그러면 실제로 연결된 뒤에도 화면이 "미연결"이라고 거짓말하게 된다.
  - 검증: 백엔드에 mock 기반 테스트 3개 추가(성공/실패/빈 결과 폴백) — `httpx`로 실제 네트워크를 부르지 않고 `app.routers.company_detail.fetch_recent_disclosures`를 monkeypatch. 프론트는 실제 키가 없어 라이브 경로를 못 돌려봐서, Playwright에서 `page.route`로 응답을 가로채 "연결됨" 상태를 흉내 낸 e2e 테스트 1개 추가(`opendart-company-detail.spec.ts`). 백엔드 `pytest` 113개, 프론트 `build`·`test:e2e`(5개) 전부 통과. 브라우저로 키 없는 기본 상태(기존과 동일한 "미연결" 문구) 직접 확인.
  - 문서: `docs/fullstack/00-readme.md`·`01-overview.md`·`04-frontend-backend-scope.md`·`05-safety-validation.md`의 "실제 외부 API 연결 안 함" 계열 문장에 OpenDART 예외를 명시. `05-safety-validation.md`의 금지 문자열 목록에서 "OpenDART API key"를 뺐다(이제 `app/integrations/opendart.py`·`app/config.py`에 한해 허용).
  - **2026-09-01: 사용자가 OpenDART 키를 발급받아 `apps/api/.env`에 채우고, 처음으로 라이브 호출을 확인했다.** 이 과정에서 `list.json` 날짜 범위 누락 버그를 발견해 고쳤다(위 "커밋 상태" 절 참고, `d511cee`). 브라우저로 기업 상세 화면을 열어 실제 공시가 뜨는 것까지 확인 완료.

## 최근 검증 메모

- `BACKEND-003`: `GET /api/dashboard` 구현과 프론트 대시보드 연결. 백엔드 `uv run pytest` 9개 통과, 프론트 `npm run typecheck`·`npm run build` 통과. 1440×900 렌더링에서 `.app-shell` 1392×852 유지, main·인스펙터 하단 잘림 없음, 문서 가로·세로 오버플로 0, 콘솔 오류 없음. 화면에 표시되는 모든 숫자 문자열이 이전 fixture 문자열과 동일함을 DOM에서 확인. 네트워크 요청 호스트가 전부 `127.0.0.1:5173`. 백엔드 중단 시 오류 안내와 재시도 버튼 표시, 백엔드 복구 후 재시도로 정상 복구 확인.
- `BACKEND-003` 부수 수정: 기존 대시보드 보유 종목 손익 셀의 색상 분기에서 현금 행이 `"-"`도 `startsWith("-")`에 걸려 `loss` 클래스를 받던 동작이 있었다. 숫자 계약으로 바뀌면서 `null` 분기로 정리됐다.
- ~~`BACKEND-003` 남은 항목: `decision.expiresAt`(14:42)이 `dataAsOf`(15:20)보다 이르다. ... 인스펙터 워크플로의 `14:28`과 "대기"는 아직 화면에 하드코딩돼 있다.~~ `FRONTEND-008`에서 해결.

- `BACKEND-002-V`: 검증자 20세대가 `GET /api/health` 단독 구현을 `통과` 판정했다. 백엔드 테스트 2개 통과, HTTP 200 JSON 응답, 필수 안전값, `/api/dashboard` 404 기대 상태가 확인됐다.
- 위 `allow_headers` 후속 후보는 `BACKEND-003`에서 처리됐다. 현재 `allow_headers`는 `Accept`, `Accept-Language`, `Content-Type` 명시 목록이고 `allow_methods`는 `GET`이다.
- `FRONTEND-FINAL-AUDIT-R1-V`: 검증자 19세대가 React/Vite 19개 화면 최종 회귀를 `통과` 판정했다. `npm run typecheck`, `npm run build`, 19개 화면 1440×900 하단 잘림 해소, 사이드바 하단 안전 고지, 새 중대/높음 회귀 없음이 확인됐다.
- ~~남은 낮음 이슈: 기업 상세 숨김 보조 텍스트 `.chart-alt`, 세금·수수료/결정 회고/역할 상태의 테스트 훅 마커 내부 가로 overflow.~~ 재확인 결과 둘 다 버그가 아니다. `.chart-alt`는 의도된 스크린리더 전용(`position:absolute; 1px×1px; clip`) 패턴이다. 테스트 훅 마커는 `16×16px`·`overflow:hidden` 고정 박스라 안의 긴 텍스트가 흘러넘쳐도 박스 크기·문서 레이아웃에 영향이 없다 — 실제 1440×900 타깃 해상도에서 `document.documentElement.scrollWidth - clientWidth`가 `0`인 것을 확인했다(더 좁은 뷰포트에서 재 것처럼 보인 127px 오버플로는 뷰포트가 이 앱의 고정 1440×900 설계보다 좁아서 생긴 착시였다).
- `FRONTEND-FINAL-AUDIT` 최초 판정은 `.app-shell`/`.workspace` 공통 높이 구조 때문에 16개 화면 하단 48px이 잘리는 `실패`였다. R1에서는 공통 레이아웃과 일부 화면 높이 정의를 조정했다.

- `MOCKUP-019` 신규 파일은 `mockup/financial-dashboard/evidence-packet.html`, `evidence-packet.css`, `evidence-packet.js`, `evidence-packet-1440x900.png`다.
- `MOCKUP-019`은 대체 독립 검증에서 `통과` 판정을 받았다. 검증자는 JS 문법, 1440×900 PNG, 1440×900 렌더링, 결정 4건, 필터 동기화, 금지 연결 패턴 부재, 안전 경계, 로컬 링크를 확인했다.
- `MOCKUP-019`은 `81b2a1d` 커밋에 포함해 원격 `main`에 푸시했다.
- `MOCKUP-019`은 실제 금융 데이터·계좌·주문·AI 실행·API·DB와 연결하지 않았다.
- `MOCKUP-018` 신규 파일은 `mockup/financial-dashboard/portfolio-change-compare.html`, `portfolio-change-compare.css`, `portfolio-change-compare.js`, `portfolio-change-compare-1440x900.png`다.
- `MOCKUP-018`은 대체 독립 검증에서 `통과` 판정을 받았다. 검증자는 JS 문법, 1440×900 PNG, 1440×900 렌더링, 필터 동기화, 금지 연결 패턴 부재, 안전 경계, 로컬 링크를 확인했다.
- `MOCKUP-018`은 실제 금융 데이터·계좌·주문·API·DB와 연결하지 않았고, `81b2a1d` 커밋에 포함해 원격 `main`에 푸시했다.
- `MOCKUP-017`은 대체 독립 검증에서 `통과` 판정을 받았다.
- 신규 파일은 `mockup/financial-dashboard/agent-role-status.html`, `agent-role-status.css`, `agent-role-status.js`, `agent-role-status-1440x900.png`다.
- `MOCKUP-017`은 실제 금융 데이터·계좌·주문·API·DB 및 실제 AI 실행과 연결하지 않았고, `81b2a1d` 커밋에 포함해 원격 `main`에 푸시했다.
- `FRONTEND-005`는 React/Vite `apps/web` 승인 대기 화면의 주문 행을 `button role="row"`에서 접근성 의미가 충돌하지 않는 선택 가능한 grid 행 구조로 정리했고, `b654282` 커밋에 포함해 원격 `main`에 푸시했다.
- `GOVERNANCE-001`은 공식 역할 작업 가시성, `create_thread` 기반 세대교체, 숨은 multi-agent 제한을 문서화했고, `93d9375` 커밋에 포함해 원격 `main`에 푸시했다.
- `MOCKUP-016`은 대체 독립 검증에서 최초 `실패`였고, 우측 인스펙터 잘림과 빈 결과 링크 R1 재작업 후 `MOCKUP-016-V-R1` 재검증에서 `통과` 판정을 받았다.
- 신규 파일은 `mockup/financial-dashboard/decision-review.html`, `decision-review.css`, `decision-review.js`, `decision-review-1440x900.png`다.
- `MOCKUP-016` 관련 커밋·푸시는 `13e0e6f`에 포함됐다.
- `MOCKUP-015`는 대체 독립 검증에서 최초 `조건부 통과`였고, 루트 README 누락 R1 재작업 후 `MOCKUP-015-V-R1` 재검증에서 `통과` 판정을 받았다.
- 신규 파일은 `mockup/financial-dashboard/tax-fee-impact.html`, `tax-fee-impact.css`, `tax-fee-impact.js`, `tax-fee-impact-1440x900.png`다.
- `MOCKUP-015` 관련 커밋·푸시는 `13e0e6f`에 포함됐다.
- `MOCKUP-014`는 검증자 8세대가 `통과` 판정했다.
- 검증자 7세대는 1차에서 조건부 통과를 냈고, R1/R2 재보고는 빈 결과로 종료됐다.
- 7세대가 지적한 하단 안전 고지 잘림 문제는 재작업 후 8세대 검증에서 해소 확인됐다.
