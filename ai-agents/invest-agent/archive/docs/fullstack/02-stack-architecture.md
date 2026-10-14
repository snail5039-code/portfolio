# 기술 스택과 구조

기준일: 2026-08-29 KST

## 추천 기술 방향

| 선택지 | 구성 | 장점 | 단점 |
|---|---|---|---|
| A안 | React + Vite 프론트엔드, FastAPI 백엔드 | 프론트/백엔드 분리가 명확하고, 금융 계산·검증·AI 실험을 Python으로 이어가기 좋다. | Python API 구조와 타입 계약을 초기에 잘 잡아야 한다. |
| B안 | React + Vite 프론트엔드, Spring Boot 백엔드 | 전통적인 웹 백엔드 포트폴리오로 설명하기 좋다. | 금융 계산, 데이터 처리, AI 파이프라인 확장에는 Python보다 우회가 많다. |
| C안 | Next.js 단일 앱, FastAPI 백엔드 | 빠른 프로토타입과 AI·데이터 처리 확장에 유리하다. | 프론트/백엔드 분리 포트폴리오 메시지가 A안보다 약하다. |

기본 추천은 **A안: React + Vite + FastAPI**다.

Spring Boot도 좋은 백엔드 선택지지만, 이 프로젝트에서는 “금융 AI 에이전트”라는 방향성과 맞춰 Python/FastAPI를 우선한다.

현재 `apps/web` React/Vite 프론트엔드는 정적 목업 19개에 대응하는 19개 화면을 포함한다. `apps/api` FastAPI 백엔드는 `BACKEND-002`에서 최소 골격과 `GET /api/health`가, `BACKEND-003`에서 `GET /api/dashboard`가 생성됐다.

프론트와 백엔드는 Vite `server.proxy`로 연결한다. 브라우저는 같은 출처 상대 경로 `/api/*`만 호출하고, dev 서버가 이를 `http://127.0.0.1:8000`으로 전달한다. 따라서 브라우저 요청 호스트는 항상 `127.0.0.1:5173` 하나다.

## 권장 저장소 구조

```text
financial-ai-agent/
├─ apps/
│  ├─ web/                    # React + Vite 프론트엔드
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ components/
│  │  │  ├─ pages/
│  │  │  ├─ api/
│  │  │  ├─ fixtures/
│  │  │  ├─ lib/
│  │  │  └─ styles/
│  │  └─ package.json
│  └─ api/                    # FastAPI 최소 백엔드, 현재 GET /api/health 단독
│     ├─ app/
│     │  ├─ main.py
│     │  ├─ routers/
│     │  ├─ schemas/
│     │  ├─ services/
│     │  └─ fixtures/
│     ├─ tests/
│     └─ pyproject.toml
├─ mockup/
│  └─ financial-dashboard/    # 기존 정적 목업 보존
├─ docs/
│  ├─ api/
│  ├─ architecture/
│  ├─ fullstack/
│  └─ handoff/
└─ README.md
```

## 보존 원칙

기존 `mockup/financial-dashboard/`는 지우지 않는다. 실제 앱 구현 중에도 화면 기준서와 회귀 확인용으로 남긴다.
