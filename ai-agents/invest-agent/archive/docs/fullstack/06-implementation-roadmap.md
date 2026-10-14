# 구현 로드맵

기준일: 2026-08-29 KST

## Phase 0: 기준 정리

- 기존 정적 목업 19개를 완료 기준으로 고정한다.
- React/Vite `apps/web`의 19개 화면 이전 완료 상태를 기준으로 고정한다.
- 화면별 필요한 데이터 필드는 기존 fixture와 `docs/fullstack/03-data-api-contract.md`를 기준으로 확인한다.
- API 미연결 원칙을 README와 앱 화면에 유지한다.

완료 기준:

- 풀스택 전환 계획 문서가 존재한다.
- `BACKEND-002`에서 첫 구현 대상 API가 `GET /api/health` 단독으로 완료됐다.
- React/Vite `apps/web` 프론트가 생성되어 정적 목업 19개에 대응하는 19개 화면을 포함한다.
- `FRONTEND-005` 승인 대기 행 접근성 정리가 완료됐다.
- `FRONTEND-FINAL-AUDIT-R1-V`에서 검증자 19세대가 최종 회귀 `통과`를 판정했다.

## Phase 1: 프로젝트 골격 (완료)

- `apps/web` React + Vite 생성 완료
- `apps/api` FastAPI 최소 골격 생성 완료
- `GET /api/health` 구현 완료

완료 기준:

- 백엔드가 `/api/health`로 로컬 상태와 안전 필드를 반환한다.
- 실제 외부 API 호출이 없다.

## Phase 2: 대시보드 수직 슬라이스 (완료)

- 백엔드 `GET /api/dashboard` 구현
- 프론트 `DashboardPage`를 서버 응답에 연결하고 로딩·오류·재시도 추가
- Vite `server.proxy`로 같은 출처 `/api/*` 호출
- 프론트 `src/fixtures/dashboard.ts` 제거

완료 기준 충족 근거:

- 정적 목업의 첫 화면과 같은 정보 구조가 컴포넌트로 동작한다. 1440×900 렌더링 회귀 확인.
- 데이터는 서버 fixture에서만 온다. 프론트 대시보드 fixture는 삭제됐다.
- 화면에 표시되는 모든 숫자 문자열이 이전 fixture 문자열과 동일하다.
- `uv run pytest` 9개 통과, `npm run typecheck`·`npm run build` 통과, 콘솔 오류 없음.

## Phase 3: 승인 흐름 수직 슬라이스

- 백엔드 `GET /api/approvals`
- 백엔드 `POST /api/approvals/{id}/approve`
- 백엔드 `POST /api/approvals/{id}/reject`
- 프론트 승인 대기 목록과 우측 상세 연결
- 승인·반려 후 감사 로그 상태 반영

완료 기준:

- 실제 주문 없이 화면 상태만 바뀐다.
- 새로고침 전까지 승인·반려 상태가 유지된다.
- 승인 응답은 실제 체결 없음이 명확하다.

## Phase 4: 근거 패킷과 변경 비교

- `GET /api/evidence-packets`
- `GET /api/portfolio-change-compare`
- 결정 선택, 필터, 인스펙터 동기화
- 관련 화면 간 링크 정리

완료 기준:

- 승인 전 근거 패킷과 변경 비교가 같은 결정 ID를 공유한다.
- 정책·비용·리스크·출처 경계가 화면에서 유지된다.

## Phase 5: 문서와 검증

- 실행 방법 정리
- API 응답 예시 문서화
- 프론트 단위 테스트
- 백엔드 단위 테스트
- Playwright 핵심 흐름 테스트

완료 기준:

- 대시보드 → 근거 패킷 → 변경 비교 → 승인 대기 → 결정 회고 흐름이 로컬에서 재현된다.
- 외부 API 호출 없음이 검색과 테스트로 확인된다.

## 다음 개발 티켓

`BACKEND-CORS-001`과 `BACKEND-003`은 완료됐다. 다음은 Phase 3 승인 흐름이다.

1. 승인·반려 상태 저장을 메모리로 할지 SQLite로 할지 확정한다.
2. `allow_methods`에 `POST` 추가를 승인한다. 현재는 `GET` 전용이라 쓰기 경로가 막혀 있다.
3. `GET /api/approvals`를 `docs/backend/07-dashboard-api.md` 계약 규칙대로 작성한다.
4. `POST /api/approvals/{id}/approve`, `POST /api/approvals/{id}/reject`를 `MockApprovalService`로 작성한다. 응답에 `executed: false`, `paperOnly: true`를 유지한다.
5. 프론트 승인 대기 화면을 연결하고 `src/fixtures/approvals.ts`를 제거한다.
6. 외부 API 호출 금지 검사를 유지한다. 프론트 `fetch`는 `src/api/` 아래 상대 경로 호출만 허용한다.

## 결정이 필요한 것

1. 승인·반려 상태를 메모리 fixture로 갈지, SQLite를 쓸지
   - 메모리는 `uvicorn --reload`에서 코드를 고칠 때마다 승인 상태가 초기화된다.
2. 감사 로그를 승인 흐름과 함께 서버로 옮길지, 뒤로 미룰지
3. OpenAPI에서 TypeScript 타입을 생성할지, Pydantic과 TS 타입을 계속 수기로 맞출지
   - 화면이 19개라 수기 관리는 드리프트가 난다. 슬라이스가 적은 지금이 도입 비용이 가장 낮다.
4. 기존 정적 목업을 계속 유지할지, 새 앱 구현 뒤 일부를 보관 문서로 옮길지
5. Playwright 핵심 흐름 테스트를 지금 넣을지, Phase 5까지 미룰지
