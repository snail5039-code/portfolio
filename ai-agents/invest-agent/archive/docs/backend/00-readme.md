# 백엔드 문서 읽기 안내

기준일: 2026-08-29 KST

## 목적

이 폴더는 FastAPI 백엔드 범위와 안전 경계를 작은 문서로 나눠 확인하기 위한 문서다. `BACKEND-001`은 문서 준비 단계였고, `BACKEND-002`에서 `apps/api` 최소 골격과 `GET /api/health` 단독 엔드포인트 구현이 완료됐다. React/Vite `apps/web` 19개 화면 이전과 `BACKEND-002` 이후에도 상위 방향과 장기 로드맵은 `FINANCIAL_AI_FULLSTACK_PLAN.md`와 `docs/fullstack/`를 따른다.

## 읽는 순서

1. `01-backend-001-scope.md`: `BACKEND-001` 문서 준비와 `BACKEND-002` 구현 완료 범위를 구분해 확인한다.
2. `02-local-fixture-contract.md`: 로컬 fixture 응답의 공통 원칙을 확인한다.
3. `03-fastapi-skeleton.md`: 현재 `apps/api` 실제 최소 구조를 확인한다.
4. `04-health-api.md`: `/api/health` 응답 필드와 검증 포인트를 확인한다.
5. `05-safety-boundary.md`: 실제 금융 연결 금지 기준과 금지 문자열을 확인한다.
6. `06-implementation-checklist.md`: 다음 구현자와 검증자의 체크리스트를 확인한다.
7. `07-dashboard-api.md`: `GET /api/dashboard` 계약, 숫자 표현 규칙, 전송 경로를 확인한다.
8. `08-account-and-agent-api.md`: 계좌와 분석·검증·실행 에이전트 4개 엔드포인트를 확인한다.
9. `09-approvals-api.md`: 이 프로젝트 최초의 쓰기 경로인 승인 대기 승인·반려 API와 메모리 저장소 설계를 확인한다.
10. `10-decision-consolidation.md`: 결정(DEC) 데이터를 화면 간에 통합한 1차 범위와 남은 범위를 확인한다.
11. `11-remaining-screens-migration.md`: 나머지 17개 화면을 전부 백엔드로 옮긴 범위, 사전 계산 방식, 발견한 React Hooks 버그를 확인한다.
12. `12-full-decision-id-audit.md`: 16개 결정 ID 전수 대조 결과와 추가로 고친 DEC-1042·1043·1044 충돌을 확인한다.

## 상위 참조

- `AGENTS.md`: 역할 분리, 승인, 검증, 금융 안전 규칙
- `docs/handoff/00-readme.md`: 인수 문서 읽기 순서
- `docs/handoff/01-current-state.md`: 현재 커밋과 제품 상태
- `docs/fullstack/03-data-api-contract.md`: 장기 API 후보 목록과 공통 데이터 원칙
- `docs/fullstack/05-safety-validation.md`: 풀스택 전환 전체 안전 기준

## 원칙

- 실제 금융 데이터, 계좌, 주문, 체결, 공시, 시세, 환율, AI 실행, 외부 API, 운영 DB는 연결하지 않는다.
- `BACKEND-001`은 문서 준비, `BACKEND-002`는 `GET /api/health`, `BACKEND-003`은 `GET /api/dashboard` 구현 단계다.
- 현재 백엔드는 실제 금융 API 대신 로컬 상태 확인 응답과 로컬 fixture 응답만 제공한다.
- `BACKEND-003`에서 CORS 헤더 명시화도 함께 처리했다. `allow_headers`는 `Accept`, `Accept-Language`, `Content-Type` 명시 목록이다.
- 프론트는 Vite `server.proxy`로 같은 출처 `/api/*`만 호출한다. 브라우저에서 절대 URL을 부르지 않는다.
- `BACKEND-004`에서 `GET /api/account`와 `GET /api/agents/{analysis|verification|execution}`을 추가했다. 사이드바에 메뉴만 있고 화면이 없던 4개 항목을 채운 것이다.
- `BACKEND-005`에서 `GET /api/approvals`, `POST /api/approvals/{id}/approve`, `POST /api/approvals/{id}/reject`를 추가했다. 이 프로젝트 최초의 쓰기 경로다. 상태는 프로세스 메모리에 있고 서버 재시작 시 초기화된다.
- `BACKEND-006`에서 DEC-1042 정적 사실과 승인 상태를 대시보드·승인 대기·에이전트 화면이 공유하도록 통합했고, DEC-1043 ID 충돌(승인 대기의 NAVER 매도 vs 검증 에이전트의 NAVER 관찰)을 발견해 후자를 DEC-1057로 분리했다.
- `BACKEND-007`에서 나머지 17개 화면을 전부 백엔드로 옮겨 **23개 화면 전체가 백엔드에 연결**됐다. `apps/web/src/fixtures/`는 완전히 비었다. DEC-1043·1044도 `decisions.py`로 통합 범위를 넓혔다.
- 이 4개 화면은 정적 목업에 대응 파일이 없다. `FINANCIAL_AI_AGENT_IDEA.md`의 역할 정의를 근거로 새로 설계했다.
- 다음 구현 후보는 승인 흐름(`GET /api/approvals`, 모의승인·반려)이다. 쓰기 경로라서 메모리 저장소와 CORS 메서드 정책 결정이 먼저 필요하다.
- 장기 API 전체 목록은 이 폴더에 복사하지 않고 `docs/fullstack/03-data-api-contract.md`를 참조한다.
