# 백엔드 초기 범위

기준일: 2026-08-29 KST

## 목표

`BACKEND-001`은 실제 FastAPI 백엔드를 만들기 전, 첫 구현자가 참고할 좁은 백엔드 1단계 기준을 확정한 문서 준비 단계다. `BACKEND-002`는 이 기준 중 `/api/health`만 실제로 구현한 단계다.

현재 완료된 최소 목표는 `apps/api` FastAPI 골격과 `GET /api/health` 단독 엔드포인트다. 대시보드, 승인 대기, 근거 패킷 등 장기 API 후보는 `docs/fullstack/03-data-api-contract.md`를 참조하고, `BACKEND-002`에서는 전체 목록을 구현하지 않았다.

## 이번 문서 작업 범위

이번 `BACKEND-001-DOCS`에서 허용되는 범위:

- `docs/backend/` 인덱스와 주제별 문서 생성
- `/api/health` 계약과 로컬 fixture 공통 응답 원칙 문서화
- 다음 구현에서 만들 `apps/api` 예상 구조 문서화
- 실제 금융 연결 금지 기준과 검증 체크리스트 문서화
- 필요 시 `docs/fullstack/00-readme.md`, `docs/handoff/01-current-state.md`, `docs/handoff/02-active-roles.md`의 참조와 상태만 갱신

`BACKEND-001` 문서 작업에서는 FastAPI 코드, `apps/api`, 패키지, React 코드를 만들지 않았다.

## BACKEND-002 완료 범위

`BACKEND-002`에서 완료된 범위:

- `apps/api` FastAPI 프로젝트 골격 생성
- `/api/health` 라우트 생성
- 평면 JSON 응답 스키마와 안전 플래그 정의
- 백엔드 테스트 위치와 기본 테스트 생성
- 실제 외부 연결이 없음을 확인하는 문자열 점검
- `/api/dashboard` 미구현 및 404 기대 상태 확인

## BACKEND-003 완료 범위

`BACKEND-003`에서 완료된 범위:

- `GET /api/dashboard` 라우터, 스키마, fixture 생성
- 공통 안전 봉투 `FixtureEnvelope` 도입, 안전 플래그를 `Literal`로 강제
- 금액 정수·비율 퍼센트 단위 원본 숫자 계약 확정
- CORS `allow_headers` 명시 목록화
- Vite `server.proxy` 도입, 프론트 절대 URL 호출 제거
- 프론트 대시보드 화면을 서버 응답에 연결하고 로컬 대시보드 fixture 제거
- 로딩·오류·재시도 상태 추가
- 백엔드 테스트 9개로 확장

## 비범위

`BACKEND-001` 문서 작업과 `BACKEND-002` 구현 모두에서 다음을 하지 않았다.

- 실제 금융 데이터, 계좌, 주문, 체결, 공시, 시세, 환율 API 연결
- 운영 DB 연결
- AI 모델을 투자 판단 또는 주문 흐름에 연결
- 실제 주문, 매수, 매도, 송금, 체결 처리
- 인증, 개인정보 저장, 유료 서비스 연결
- React 화면 구조 변경
- 장기 API 전체 구현

## 현재 상태와 연결

React/Vite `apps/web`는 19개 화면을 가지고 있고, 그중 대시보드 한 화면이 백엔드 `GET /api/dashboard`에 연결돼 있다. 나머지 18개 화면은 아직 프론트 로컬 fixture를 쓴다. 따라서 다음 구현은 기존 프론트 상태와 두 엔드포인트를 깨지 않고, 승인 흐름처럼 화면 한 개 단위의 좁은 수직 슬라이스에 집중한다.

## 성공 기준

- `GET /api/health`의 책임이 분명하다.
- 모든 백엔드 응답은 모의 상태임을 드러내는 안전 필드를 포함한다.
- 실제 금융 행동으로 오인될 이름, 응답, 흐름을 만들지 않는다.
- 구현 후 검증자는 코드 생성 범위와 안전 경계를 독립적으로 확인할 수 있다.
