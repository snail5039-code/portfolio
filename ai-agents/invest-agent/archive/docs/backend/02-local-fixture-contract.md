# 로컬 Fixture 응답 계약

기준일: 2026-08-29 KST

## 공통 응답 래퍼

향후 백엔드 fixture API는 모든 응답에 같은 안전 메타데이터를 포함한다. `BACKEND-002`의 `GET /api/health`는 실제 구현에 맞춰 `data` 래퍼 없는 평면 JSON으로 제공한다.

```json
{
  "generatedAt": "2026-08-28T10:00:00+09:00",
  "dataAsOf": "2026-08-27T15:20:00+09:00",
  "sourceLabel": "로컬 fixture",
  "isMock": true,
  "paperOnly": true,
  "executed": false,
  "disclaimer": "화면 검토용 가상 예시이며 실제 금융 데이터·계좌·주문·API와 연결되지 않습니다.",
  "data": {}
}
```

## 필수 필드 원칙

- `generatedAt`: 백엔드가 응답을 만든 시각이다. ISO 8601 문자열을 사용한다.
- `dataAsOf`: fixture 데이터의 기준 시각이다. 실제 시세 기준 시각이 아니라 화면용 예시 기준이다.
- `sourceLabel`: 데이터 출처를 `로컬 fixture`, `화면용 가상 예시`처럼 표시한다.
- `isMock`: 항상 `true`다.
- `paperOnly`: 항상 `true`다.
- `executed`: 주문, 승인, 반려 응답에서도 항상 `false`다.
- `disclaimer`: 실제 금융 연결이 없음을 사람이 읽을 수 있게 설명한다.
- `externalConnections`: 항상 `0`이다.
- `data`: 화면별 fixture 본문이다. 금액은 정수, 비율은 퍼센트 단위 실수로 담고 화면 문자열은 넣지 않는다.

`app/schemas/common.py`의 `FixtureEnvelope`가 이 필드들을 정의하고, 안전 플래그는 `Literal`로 강제한다. 따라서 실제 연결 상태를 나타내는 값은 이 계약으로 표현할 수 없다.

## `/api/health` 적용

`GET /api/health`도 공통 안전 필드를 포함한다. 상태 확인 응답이더라도 실제 금융 시스템 연결 상태처럼 보이지 않게 `externalConnections: 0`을 함께 둔다. 현재 실제 구현은 `status`, `service`, `generatedAt`, `dataAsOf`, `sourceLabel`, `isMock`, `paperOnly`, `externalConnections`, `executed`, `disclaimer`를 최상위에 둔다. 자세한 응답 예시는 `04-health-api.md`를 따른다.

## 로컬 fixture API 골격 적용

`BACKEND-003`의 `GET /api/dashboard`가 이 봉투 구조를 처음 적용한 화면 API다. 실제 필드와 숫자 표현 규칙은 `07-dashboard-api.md`를 본다. 이후 화면별 fixture API도 같은 봉투와 같은 숫자 규칙을 따른다. 이 문서는 모든 fixture 응답이 반드시 가져야 할 공통 안전 원칙을 정의한다.

## 승인·반려 응답 원칙

승인 또는 반려 API를 이후 단계에서 만들더라도 실제 주문 결과처럼 표현하지 않는다.

- 승인은 `모의승인` 또는 `paper approval` 성격으로만 표현한다.
- 반려는 로컬 데모 상태 변경으로만 표현한다.
- 응답에는 `executed: false`와 `paperOnly: true`를 유지한다.
- 체결 ID, 실제 주문 번호, 증권사 접수 번호처럼 보이는 필드는 만들지 않는다.

## 장기 API 참조

전체 API 후보 목록은 이 문서에 복사하지 않는다. 장기 범위는 `docs/fullstack/03-data-api-contract.md`를 참조한다. 현재 직접 구현된 것은 `/api/health`와 `/api/dashboard`다.
