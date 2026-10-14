# Dashboard API

기준일: 2026-09-01 KST

## 목적

`GET /api/dashboard`는 투자 운영 대시보드 화면이 사용하는 로컬 fixture를 반환한다. `BACKEND-003`에서 구현했고, 프론트 `apps/web`의 대시보드 화면이 이 응답만 사용한다. 프론트에 있던 `src/fixtures/dashboard.ts`는 제거했다.

이 엔드포인트는 실제 계좌, 주문, 체결, 시세, 공시, 환율, 외부 API, 운영 DB를 조회하지 않는다. 값은 저장소에 커밋된 리터럴이다.

## 전송 경로

브라우저는 절대 URL을 호출하지 않는다. 프론트는 같은 출처 상대 경로 `/api/dashboard`만 호출하고, Vite dev 서버가 `server.proxy`로 `http://127.0.0.1:8000`에 전달한다.

```text
브라우저 ──/api/dashboard──▶ Vite(127.0.0.1:5173) ──프록시──▶ FastAPI(127.0.0.1:8000)
```

따라서 브라우저에서 CORS 프리플라이트가 발생하지 않는다. 백엔드 CORS 설정은 직접 호출에 대한 2차 경계로만 남긴다.

## 숫자 표현 규칙

이 계약의 핵심은 **서버가 원본 숫자를 주고, 화면 문자열은 프론트가 만든다**는 것이다.

- 금액 필드는 `data.currency`(현재 `"KRW"`) 기준 **정수**다. `128450000`
- 비율 필드는 **퍼센트 단위 실수**다. `6.65`는 6.65%를 뜻하며 0.0665가 아니다.
- 해당 없는 값은 `"-"`, `""` 같은 자리표시 문자열이 아니라 `null`이다. 현금 행의 `averagePrice`가 그렇다.
- 시각은 KST 오프셋을 포함한 ISO 8601 문자열이다. `"2026-08-27T14:31:00+09:00"`
- 천단위 구분, 부호, `원`·`%`·`주` 접미사, 소수 자릿수는 전부 프론트 `src/lib/format.ts`가 담당한다.

이 규칙은 뒤이어 비용·비중·위험 계산을 서버 함수로 옮길 때(`docs/fullstack/04-frontend-backend-scope.md` 백엔드 2단계) 계약을 다시 뜯지 않기 위한 것이다.

## 응답 구조

`/api/health`와 달리 화면용 fixture API는 `docs/backend/02-local-fixture-contract.md`의 봉투 구조를 따른다.

```json
{
  "generatedAt": "2026-09-01T08:31:15.645603+09:00",
  "dataAsOf": "2026-08-27T15:20:00+09:00",
  "sourceLabel": "로컬 fixture",
  "isMock": true,
  "paperOnly": true,
  "executed": false,
  "externalConnections": 0,
  "disclaimer": "화면 검토용 가상 예시이며 실제 금융 데이터·계좌·주문·체결·외부 API와 연결되지 않습니다.",
  "data": {
    "title": "투자 운영",
    "accountLabel": "시뮬레이션 계좌",
    "currency": "KRW",
    "summary": {
      "totalAsset": 128450000,
      "todayProfit": 1042000,
      "todayProfitRate": 0.82,
      "principal": 112000000,
      "accumulatedProfit": 16450000,
      "cashWeight": 18.4,
      "lastVerifiedAt": "2026-08-27T14:31:00+09:00"
    },
    "chart": [
      { "label": "8월 2주", "portfolio": 6.42, "benchmark": 3.18, "event": "검증 후 삼성전자 10주 모의승인 후보" }
    ],
    "holdings": [
      {
        "name": "삼성전자",
        "code": "005930",
        "quantity": 120,
        "averagePrice": 68420,
        "currentPrice": 71200,
        "value": 8544000,
        "profit": 333600,
        "profitRate": 4.06,
        "weight": 6.65,
        "status": "비중 확대 검토",
        "tone": "warning",
        "selected": true
      },
      {
        "name": "현금성 자산",
        "code": "KRW",
        "quantity": null,
        "averagePrice": null,
        "currentPrice": null,
        "value": 23640000,
        "profit": null,
        "profitRate": null,
        "weight": 18.4,
        "status": "대기",
        "tone": "info",
        "selected": false
      }
    ],
    "decision": {
      "company": "삼성전자",
      "code": "005930",
      "decisionId": "DEC-1042",
      "status": "조건부 승인 후보",
      "statusTone": "warning",
      "proposal": "삼성전자 10주 지정가 매수",
      "limitPrice": 71200,
      "limitAmount": 712000,
      "targetWeightFrom": 6.65,
      "targetWeightTo": 7.2,
      "expiresAt": "2026-08-27T14:42:00+09:00",
      "evidence": [],
      "checks": [],
      "invalidConditions": []
    }
  }
}
```

`chart`, `holdings`, `evidence`, `checks`는 위 예시에서 일부만 실었다. 실제 응답의 전체 항목 수는 각각 7, 6, 3, 4다.

## 안전 필드 강제

`app/schemas/common.py`의 `FixtureEnvelope`는 안전 플래그를 `Literal`로 선언한다.

```python
isMock: Literal[True] = True
paperOnly: Literal[True] = True
executed: Literal[False] = False
externalConnections: Literal[0] = 0
```

따라서 실제 연결 상태를 나타내는 값은 이 계약으로 표현할 수 없다. 모든 스키마는 `extra="forbid"`라서 정의되지 않은 필드도 통과하지 못한다.

프론트 `src/api/client.ts`는 응답을 화면에 넘기기 전 같은 네 필드를 다시 확인하고, 하나라도 어긋나면 렌더링하지 않고 오류로 처리한다.

## 파일 구성

```text
apps/api/app/
├─ clock.py                  # KST ISO 8601 문자열 생성
├─ fixtures/dashboard.py     # 대시보드 fixture 리터럴
├─ routers/dashboard.py      # GET /api/dashboard
└─ schemas/
   ├─ common.py              # FixtureEnvelope, Tone
   └─ dashboard.py           # 대시보드 응답 타입

apps/web/src/
├─ api/client.ts             # /api/ 상대 경로 전용 fetch, 안전 필드 검사
├─ api/dashboard.ts          # getDashboard()
├─ lib/format.ts             # 원본 숫자 → 화면 문자열
└─ pages/DashboardPage.tsx   # 로딩·오류·재시도 포함
```

## 검증 포인트

- HTTP 200이고 JSON이다.
- 봉투에 `isMock: true`, `paperOnly: true`, `executed: false`, `externalConnections: 0`이 있다.
- 금액 필드가 정수이고, 포맷된 문자열이 응답에 없다.
- `holdings[].value` 합계가 `summary.totalAsset`과 같다.
- `holdings[].weight`가 `value / totalAsset * 100`과 0.01%p 이내로 일치한다.
- 현금 행의 `quantity`, `averagePrice`, `currentPrice`, `profit`, `profitRate`가 `null`이다.
- `uv run pytest` 기준 백엔드 테스트 9개가 통과한다.
- 브라우저 네트워크 요청 호스트가 전부 `127.0.0.1:5173`이다.
- 백엔드를 내리면 화면이 오류 안내와 재시도 버튼을 보여주고, 백엔드를 올린 뒤 재시도로 복구된다.

## 알려진 후속 항목

- `decision.expiresAt`(14:42)이 `dataAsOf`(15:20)보다 이르다. 기존 정적 목업 fixture에서 이어진 값이라 이번 작업에서 숫자를 바꾸지 않았다. 승인 흐름을 붙일 때 만료 시각 기준을 다시 정해야 한다.
- 워크플로 단계의 `14:28`과 "대기"는 아직 화면에 하드코딩돼 있다. 승인 흐름 API가 생기면 서버 값으로 옮긴다.
- React `StrictMode` 때문에 dev 모드에서 `/api/dashboard`가 두 번 호출된다. 프로덕션 빌드에서는 한 번이다.
