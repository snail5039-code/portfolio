# 승인 대기 API

기준일: 2026-09-01 KST

## 목적

`BACKEND-005`에서 이 프로젝트 최초의 **쓰기 경로**를 추가했다. 승인 대기 화면의 「모의승인」·「반려」 버튼이 이제 로컬 백엔드 상태를 실제로 바꾼다.

| Method | Endpoint | 용도 |
|---|---|---|
| `GET` | `/api/approvals` | 승인 대기 4건 목록 |
| `POST` | `/api/approvals/{decision_id}/approve` | 로컬 상태에서 모의승인 |
| `POST` | `/api/approvals/{decision_id}/reject` | 로컬 상태에서 반려 |

## 상태 저장소: 메모리, 서비스 뒤에 숨김

`app/store/approvals.py`의 `ApprovalStore`가 상태를 들고 있다. 지금은 프로세스 메모리의 딕셔너리 하나다.

- 서버가 재시작되면 4건 전부 `pending`으로 돌아온다. 문서 원칙(`02-local-fixture-contract.md`)에 이미 있는 "서버 재시작 시 상태 초기화 허용"과 일치한다.
- `list()` / `get()` / `decide()` 세 메서드만 라우터에서 호출한다. 나중에 이 클래스의 내부를 SQLite로 바꿔도 이 세 시그니처만 유지하면 라우터는 한 줄도 안 바뀐다.
- 스토어는 모듈 전역이 아니라 `create_app()`마다 새로 만들어 `app.state.approval_store`에 둔다. 그래서 테스트끼리 상태가 새지 않는다(`test_store_state_is_isolated_per_app_instance`로 검사).

### SQL로 바꿔야 할 후속 작업 — 지금은 아님

아래 항목이 생기면 그때 메모리를 SQLite로 바꾼다. 지금은 필요 없다.

- **감사 로그가 실제로 남아야 할 때.** "누가 언제 승인했는지"가 서버 재시작에 사라지면 감사 로그라고 부르기 어렵다.
- **승인 이력·결정 회고가 재시작 뒤에도 조회 가능해야 할 때.**
- **기간 필터·정렬·검색이 필요해질 때.** 그 전까지는 딕셔너리로 충분하고, SQLite는 마이그레이션·스키마 관리라는 지금 안 쓰는 비용만 생긴다.

바꿀 때는 `ApprovalStore`를 SQLite 버전으로 교체하고, `app/main.py`의 `app.state.approval_store = ApprovalStore()` 한 줄만 새 클래스로 바꾸면 된다.

## 결정 상태는 세 가지뿐이다

`decisionStatus`: `pending` → `approved` 또는 `rejected`. **그 이상은 없다.** `executed`, `filled` 같은 값은 이 스키마에 아예 없다. 모의승인은 "실제로 체결됨"을 표현할 방법이 구조적으로 없다.

- `reviewLabel`은 검증 단계에서 매긴 고정 라벨(`조건부 승인`, `출처 미확인` 등)이고 결정이 바뀌어도 그대로다. 화면에 실제로 보이는 문구는 `decisionStatus`가 `pending`이면 `reviewLabel`, 아니면 `모의승인됨`/`반려됨`이다.
- `decidedAt`은 결정 전에는 `null`이고, 결정 후 KST ISO 8601로 채워진다.

## 충돌 처리

- 모르는 `decision_id` → `404`
- 이미 `pending`이 아닌 건을 다시 승인/반려 → `409`, `detail`에 한글로 "DEC-1042은(는) 이미 approved 상태라 다시 결정할 수 없습니다." 같은 메시지

프론트는 결정된 주문의 버튼을 비활성화해 사용자가 이 경로를 정상적으로 밟을 일이 없다. `409`는 동시 탭·중복 요청에 대한 방어선이다.

## 프론트 연결

- `src/api/approvals.ts`: `getApprovals()`, `approveOrder(id)`, `rejectOrder(id)`
- `src/api/client.ts`에 `postFixtureAction()` 추가. FastAPI의 `{"detail": "..."}` 본문을 그대로 사용자에게 보여준다 — 404/409는 서버 다운이 아니라 의미 있는 도메인 오류이기 때문이다.
- `ApprovalQueuePage.tsx`는 최초 목록을 `useFixture`로 받고, 승인/반려 응답을 `overrides` 맵에 얹어 화면에 즉시 반영한다. 재요청(refetch) 없이 반영하는 이유는 전체 화면이 다시 "불러오는 중"으로 깜빡이지 않게 하기 위해서다. `overrides`는 새 envelope가 도착하면(로드 실패 후 재시도 등) 초기화된다.
- `src/fixtures/approvals.ts`는 제거했다. 이 화면은 이제 백엔드 데이터만 쓴다.

## CORS

`allow_methods`에 `POST`를 추가했다(`GET`만 있던 것에서 확장). Origin·헤더 목록은 그대로다.

## 검증 포인트

- `GET /api/approvals`가 4건을 `pending`으로 반환한다(서버 갓 시작 시).
- `POST .../approve` 후 `decisionStatus: "approved"`, `decidedAt` 채워짐, 봉투 `executed: false` 유지.
- 같은 건을 다시 승인 → `409`.
- 모르는 ID → `404`.
- 한 건을 승인해도 나머지 3건은 `pending` 그대로.
- 서로 다른 `create_app()` 인스턴스는 상태를 공유하지 않는다.
- 새로고침(전체 페이지 리로드)해도 서버가 살아있는 한 결정 상태가 유지된다 — 클라이언트 착각이 아니라 서버 메모리에 실제로 남아 있다는 뜻이다.
- 1440×900에서 하단 잘림·오버플로 없음, 콘솔에 앱이 발생시킨 오류 없음(의도적으로 404/409를 유발한 테스트 호출의 브라우저 네트워크 로그는 제외).

## 알려진 후속 항목

- 사이드바의 「승인 대기 4」 배지는 여전히 하드코딩된 고정값이다. 실제 대기 건수를 반영하지 않는다. 다음 손댈 때 `GET /api/approvals`의 `pending` 개수로 바꾼다.
- `expiresAt`이 fixture 기준 시각보다 이른 문제(`07-dashboard-api.md`에 이미 기록)는 이 4건에도 그대로 있다. 만료 로직을 실제로 만들 때 함께 정리한다.
