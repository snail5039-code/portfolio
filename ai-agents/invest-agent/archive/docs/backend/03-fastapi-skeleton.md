# FastAPI 골격

기준일: 2026-08-29 KST

## 현재 상태

`apps/web` React/Vite 프론트엔드는 이미 존재한다. `BACKEND-002`에서 `apps/api` FastAPI 최소 골격과 `GET /api/health`가, `BACKEND-003`에서 `GET /api/dashboard`가 생성됐다. 현재 백엔드가 제공하는 엔드포인트는 이 둘이다.

## 현재 폴더 구조

```text
apps/api/
├─ app/
│  ├─ __init__.py
│  ├─ main.py
│  ├─ clock.py
│  ├─ fixtures/
│  │  ├─ __init__.py
│  │  ├─ dashboard.py
│  │  ├─ account.py
│  │  ├─ agents.py
│  │  └─ approvals.py
│  ├─ store/
│  │  ├─ __init__.py
│  │  └─ approvals.py
│  ├─ routers/
│  │  ├─ __init__.py
│  │  ├─ health.py
│  │  ├─ dashboard.py
│  │  ├─ account.py
│  │  ├─ agents.py
│  │  └─ approvals.py
│  ├─ schemas/
│  │  ├─ __init__.py
│  │  ├─ common.py
│  │  ├─ health.py
│  │  ├─ dashboard.py
│  │  ├─ account.py
│  │  ├─ agents.py
│  │  └─ approvals.py
├─ tests/
│  ├─ __init__.py
│  ├─ test_health.py
│  ├─ test_dashboard.py
│  ├─ test_account.py
│  ├─ test_agents.py
│  └─ test_approvals.py
├─ pyproject.toml
└─ uv.lock
```

## 책임 분리

- `main.py`: FastAPI 앱 생성, 라우터 등록, 로컬 CORS 설정
- `clock.py`: KST ISO 8601 응답 시각 생성
- `routers/health.py`: `GET /api/health` 엔드포인트
- `routers/dashboard.py`: `GET /api/dashboard` 엔드포인트
- `schemas/common.py`: 모든 fixture 응답이 공유하는 안전 봉투 `FixtureEnvelope`와 `Tone`
- `schemas/health.py`: health 평면 JSON 응답 타입
- `routers/account.py`: `GET /api/account` 엔드포인트
- `routers/agents.py`: `GET /api/agents/{analysis|verification|execution}` 엔드포인트
- `routers/approvals.py`: `GET /api/approvals`, `POST /api/approvals/{id}/approve`, `POST /api/approvals/{id}/reject`
- `store/approvals.py`: 승인 상태 메모리 저장소. `list()`/`get()`/`decide()` 세 메서드만 라우터가 호출하므로 SQLite로 바꿔도 이 파일만 교체하면 됨
- `schemas/dashboard.py`: 대시보드 봉투와 본문 타입
- `schemas/account.py`: 계좌 봉투와 본문 타입
- `schemas/agents.py`: 세 에이전트 단계가 공유하는 봉투와 본문 타입
- `fixtures/dashboard.py`, `fixtures/account.py`, `fixtures/agents.py`: 화면별 fixture 리터럴
- `tests/`: 안전 플래그, 응답 구조, 숫자 계약, 금액 정합성 검증

## 명명 원칙

- 실제 주문처럼 보이는 서비스명은 피한다.
- 승인 처리는 이후 단계에서도 `MockApprovalService`, `paperOnly`, `executed: false`처럼 모의 상태가 드러나는 이름을 사용한다.
- 증권사, 계좌, 주문, 체결, 공시, 시세, 환율 연결을 암시하는 모듈명은 만들지 않는다.

## 다음 구현 전 확인

- CORS `allow_headers` 명시화는 `BACKEND-003`에서 완료했다.
- 대시보드 연결 범위는 대시보드 한 화면으로 확정했고 `BACKEND-003`에서 완료했다.
- 다음은 승인 흐름이다. 쓰기 경로이므로 착수 전 두 가지를 먼저 정해야 한다.
  - 승인·반려 상태를 메모리 저장소로 둘지 SQLite로 둘지
  - `allow_methods`에 `POST`를 추가할 시점 (현재는 `GET` 전용)
- 승인 흐름 계획이 승인되기 전에는 approvals 라우터, fixture, 서비스 파일을 만들지 않는다.
