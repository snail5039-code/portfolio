# 금융 AI 에이전트 풀스택 전환 계획

> 기준일: 2026-08-29 KST  
> 현재 기준: 정적 HTML 목업 19개 완료, React/Vite `apps/web` 19개 화면 이전 완료, 최신 커밋 `8d0c3a9946549d1f9e570e8086843d7f5068c88f` (`8d0c3a9 백엔드 헬스 API 골격 추가`), `BACKEND-002-V` 통과  
> 문서 목적: 실제 금융 API를 연결하지 않고, 정적 목업을 프론트엔드와 백엔드가 통신하는 실행 가능한 앱 구조로 옮기기 위한 상위 계획을 정리한다.

## 현재 결정

- 정적 화면 추가는 일단 멈춘다.
- 현재 19개 목업을 제품 흐름 1차 기준으로 본다.
- React/Vite 프론트엔드 `apps/web`는 이미 생성됐고 정적 목업 19개에 대응하는 19개 화면 이전이 완료됐다.
- `FRONTEND-005`에서 승인 대기 화면의 주문 행 접근성 구조를 정리했다.
- `FRONTEND-FINAL-AUDIT` 최초 검증은 16개 화면 1440×900 하단 잘림으로 실패했지만, `FRONTEND-FINAL-AUDIT-R1` CSS 수정 뒤 검증자 19세대가 `FRONTEND-FINAL-AUDIT-R1-V`에서 최종 회귀 `통과`를 판정했다.
- `BACKEND-002`에서 FastAPI 백엔드 최소 골격과 `GET /api/health`를 구현했다.
- `BACKEND-003`에서 `GET /api/dashboard`를 구현하고 프론트 대시보드 화면을 연결했다. 프론트 대시보드 fixture는 제거했다.
- 프론트-백엔드 통신은 Vite `server.proxy`를 통한 같은 출처 상대 경로 `/api/*`다.
- 응답 계약은 금액 정수·비율 퍼센트 단위 원본 숫자이고, 화면 문자열은 프론트가 만든다.
- `BACKEND-004`에서 계좌·분석 에이전트·검증 에이전트·실행 에이전트 4개 화면과 대응 API를 새로 만들었다. React 화면은 23개다.
- `BACKEND-005`에서 승인 대기 화면에 이 프로젝트 최초의 쓰기 경로(모의승인·반려)를 연결했다. 상태는 메모리 저장소에 있다.
- `BACKEND-006`에서 결정(DEC) 데이터 통합 1차를 완료했다.
- `BACKEND-007`에서 나머지 17개 화면을 전부 백엔드로 옮겼다. **23개 화면 전체가 백엔드에 연결**됐고 프론트 `apps/web/src/fixtures/`는 완전히 비었다.
- 이 4개는 정적 목업에 대응 파일이 없어 `FINANCIAL_AI_AGENT_IDEA.md` 역할 정의를 근거로 새로 설계했다. 정적 목업은 19개 기준서로 동결한다.
- `/api/approvals` 등 나머지 경로는 아직 구현하지 않았으며 404가 기대 상태다.
- 실제 금융 데이터, 계좌, 주문, 체결, 공시, 시세, 환율, AI 실행, 외부 API, 운영 DB는 연결하지 않는다.

## 추천 방향

현재 추천은 **대시보드 수직 슬라이스를 마친 상태를 기준으로 승인 흐름을 다음 슬라이스로 붙이는 것**이다.

이유:

- 프론트엔드와 백엔드 분리가 명확하다.
- 금융 계산, 검증 로직, fixture 데이터, 나중의 AI 에이전트 실험을 Python 생태계로 이어가기 좋다.
- 실제 API를 붙이지 않아도 현재 프론트 화면 흐름과 로컬 백엔드 계약을 먼저 검증할 수 있다.

## 분할 문서

세부 계획은 아래 문서를 순서대로 참조한다.

1. `docs/fullstack/00-readme.md`: 읽는 순서와 현재 결론
2. `docs/fullstack/01-overview.md`: 현재 판단, 목표, 비목표
3. `docs/fullstack/02-stack-architecture.md`: 기술 스택과 폴더 구조
4. `docs/fullstack/03-data-api-contract.md`: 데이터 원칙과 로컬 API 범위
5. `docs/fullstack/04-frontend-backend-scope.md`: 프론트엔드·백엔드 전환 범위
6. `docs/fullstack/05-safety-validation.md`: 안전장치와 검증 기준
7. `docs/fullstack/06-implementation-roadmap.md`: 구현 단계와 첫 개발 티켓

## 다음 관문

승인 흐름 구현을 시작하기 전 확정할 항목은 다음이다.

1. 승인·반려 상태를 메모리 저장소로 둘지, SQLite까지 도입할지
2. `allow_methods`에 `POST`를 추가할 시점 (현재는 `GET` 전용이라 쓰기 경로가 막혀 있다)
3. OpenAPI에서 TypeScript 타입을 생성할지, Pydantic과 TS 타입을 계속 수기로 맞출지
4. 기존 정적 목업을 계속 기준서로 유지할지, 새 앱 구현 뒤 일부를 보관 문서로 옮길지
5. Playwright 핵심 흐름 테스트를 지금 넣을지, 뒤로 미룰지

현재 추천은 메모리 저장소로 승인 흐름 슬라이스를 붙이면서 OpenAPI 타입 생성을 함께 도입하는 것이다.
