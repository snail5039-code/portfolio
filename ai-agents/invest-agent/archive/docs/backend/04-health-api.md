# Health API

기준일: 2026-08-29 KST

## 목적

`GET /api/health`는 백엔드가 로컬에서 실행 중이고 실제 금융 연결 없이 fixture 모드로 동작한다는 점을 확인하는 최소 엔드포인트다.

이 엔드포인트는 사용자 계좌, 실제 주문, 시세, 공시, 환율, AI 실행 상태를 확인하지 않는다. 서버 프로세스가 살아 있고 안전 플래그가 유지되는지만 확인한다.

## 실제 응답 예시

```json
{
  "status": "ok",
  "service": "financial-ai-agent-api",
  "generatedAt": "2026-08-29T20:45:48.872901+09:00",
  "dataAsOf": "2026-08-29T20:45:48.872901+09:00",
  "sourceLabel": "local FastAPI health",
  "isMock": true,
  "paperOnly": true,
  "externalConnections": 0,
  "executed": false,
  "disclaimer": "Local development status only. No real financial data, execution, market data, external API, or persistent storage is connected."
}
```

## 필드 기준

- `status`: 정상일 때 `ok`
- `service`: 로컬 백엔드 식별자
- `generatedAt`: 응답 생성 시각, KST 오프셋 포함 ISO 8601 문자열
- `dataAsOf`: health 상태 기준 시각, KST 오프셋 포함 ISO 8601 문자열
- `sourceLabel`: `local FastAPI health`
- `isMock`: 항상 `true`
- `paperOnly`: 항상 `true`
- `externalConnections`: 항상 `0`
- `executed`: 항상 `false`
- `disclaimer`: 실제 금융 데이터, 실행, 시세, 외부 API, 영구 저장소 연결이 없음을 설명

## 검증 포인트

- HTTP 200으로 응답한다.
- 응답이 JSON이다.
- `isMock`, `paperOnly`, `executed`, `disclaimer`가 누락되지 않는다.
- 응답은 `data` 래퍼 없는 평면 JSON이다.
- `externalConnections`는 `0`이다.
- `/api/approvals` 등 미구현 경로는 404가 기대 상태다. `/api/dashboard`는 `BACKEND-003`에서 구현됐고 검증 포인트는 `07-dashboard-api.md`를 본다.
- 외부 API, 실제 계좌, 실제 주문, 운영 DB 연결을 시도하지 않는다.
- 로그나 환경변수에 비밀키 또는 실제 금융 연결 정보가 필요하지 않다.
