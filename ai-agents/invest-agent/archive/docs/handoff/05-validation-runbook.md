# 검증 체크리스트

새 화면, React/Vite 앱, FastAPI 백엔드, 문서 중 무엇을 검증하는지 먼저 분리한다. 검증 대상에 맞는 절을 선택하되, 금융 안전 검증은 항상 포함한다.

## 문서 검증

- 문서가 현재 Git 기준과 맞는지 확인한다.
- `HEAD`와 `origin/main`이 요구된 해시와 일치하는지 확인한다.
- 역할 표의 현재 활성 세대와 이전 세대 이력이 섞이지 않는지 확인한다.
- 현재 상태 설명이 실제 구현 상태와 맞는지 확인한다.
- 문서 작업 검증에서는 코드, 패키지, 테스트 산출물이 새로 생기지 않았는지 확인한다.

## 정적 목업 검사

- 새 JavaScript 파일에 대해 `node --check <file>.js`를 실행한다.
- 다음 금지 패턴이 없는지 확인한다.
  - `fetch`
  - `XMLHttpRequest`
  - `WebSocket`
  - `EventSource`
  - `sendBeacon`
  - `localStorage`
  - `sessionStorage`
  - `indexedDB`
  - `document.cookie`
- 외부 URL

## 정적 목업 로컬 렌더 검증

- 로컬 서버:

```powershell
cd "C:\Users\snail\OneDrive\바탕 화면\new_idea\mockup\financial-dashboard"
python -m http.server 4173 --bind 127.0.0.1
```

- 기준 화면: 1440×900
- 앱 창: 1392×852
- 내부 열: 223px / 815px / 352px
- 가로 오버플로 없음
- 콘솔 오류 없음
- 새 캡처는 실제 PNG 헤더와 1440×900 크기를 확인한다.

## React/Vite 최종 감사 기준

- 로컬 정적 검사:
  - `cd apps/web`
  - `npm run typecheck`
  - `npm run build`
- 23개 화면 라우팅:
  - 포트폴리오
  - 계좌
  - 기업 상세
  - 거래 내역
  - 세금·수수료
  - 리스크 알림
  - 백테스트
  - 전략 조정
  - 변경 비교
  - 근거 패킷
  - 스트레스 테스트
  - 포트폴리오 건강
  - 승인 대기
  - 역할 상태
  - 분석 에이전트
  - 검증 에이전트
  - 실행 에이전트
  - 투자 리포트
  - 감사 로그
  - 결정 회고
  - 투자 정책
  - 알림 설정
  - 데이터 연결
- 1440×900 기준:
  - `.app-shell` 앱 창이 1392×852 기준으로 들어오는지 확인한다.
  - main 영역과 우측 인스펙터의 `getBoundingClientRect().bottom`이 `.app-shell` 하단 밖으로 나가지 않는지 확인한다.
  - 사이드바 하단 안전 고지가 앱 하단 안에 남는지 확인한다.
  - `documentElement.scrollWidth/clientWidth`, `scrollHeight/clientHeight`로 문서 전체 가로·세로 오버플로가 없는지 확인한다.
- 회귀 상호작용:
  - 사이드바 그룹, 문구, 순서, 활성 상태가 유지되는지 확인한다.
  - 필터 변경 시 목록, 개수, 선택, 인스펙터, 관련 링크, ARIA 상태가 함께 갱신되는지 확인한다.
  - 빈 결과에서는 이전 상세나 이전 링크가 남지 않는지 확인한다.
  - 콘솔 오류가 없는지 확인한다.
- 안전 문구와 금지 연결:
  - `모의투자`, `화면 검토용 가상 예시`, `실제 주문 아님`, `실제 계좌·API·DB 미연결` 등 화면별 필수 안전 문구가 유지되는지 확인한다.
  - `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, 외부 URL, 실제 금융 연결을 암시하는 문자열을 확인한다.
  - `fetch`는 `BACKEND-003` 이후 로컬 백엔드 연결 목적에 한해 허용한다. 허용 조건은 다음 셋을 모두 만족할 때다.
    - 호출 인자가 `/api/`로 시작하는 **상대 경로**여야 한다. 절대 URL, 외부 호스트, 프로토콜 문자열을 쓰지 않는다.
    - 호출은 `src/api/` 아래 클라이언트 모듈에만 존재해야 한다. 페이지·컴포넌트에서 직접 호출하지 않는다.
    - 응답은 `isMock`, `paperOnly`, `executed`, `externalConnections` 안전 표시를 확인한 뒤에만 화면에 사용한다.
  - 위 조건을 벗어난 `fetch` 사용은 여전히 금지 대상이며 검증자가 `중대`로 분류한다.
  - React 검증에서는 백엔드 구현 상태와 무관하게 **외부** 네트워크 또는 운영 DB 연결이 없어야 한다. 로컬 백엔드 호출은 Vite `server.proxy`를 통해 같은 출처 `/api/*`로만 나간다.
  - 브라우저 네트워크 탭에서 모든 요청 호스트가 `127.0.0.1:5173`인지 확인한다.

## FastAPI 백엔드 검증

- `BACKEND-002` 이후에는 `apps/api` 최소 FastAPI 골격이 존재한다.
- 현재 구현된 백엔드 엔드포인트는 `GET /api/health` 단독이다.
- `/api/health`는 HTTP 200 JSON으로 응답해야 한다.
- 응답은 평면 JSON이며 `status`, `service`, `generatedAt`, `dataAsOf`, `sourceLabel`, `isMock`, `paperOnly`, `externalConnections`, `executed`, `disclaimer`를 포함해야 한다.
- `isMock`은 `true`, `paperOnly`는 `true`, `externalConnections`는 `0`, `executed`는 `false`여야 한다.
- `BACKEND-003` 이후 `GET /api/dashboard`, `BACKEND-004` 이후 `GET /api/account`와 `GET /api/agents/{analysis|verification|execution}`이 추가됐다. `/api/approvals` 등 미구현 경로는 404가 기대 상태다.
- **프록시 확인은 상태 코드만 보지 않는다.** Vite dev 서버는 프록시가 꺼져 있으면 `/api/*`를 SPA fallback으로 처리해 `index.html`을 200으로 돌려준다. `content-type`까지 확인한다.

```bash
curl -s -H "Accept: application/json" -o /dev/null -w "%{http_code} %{content_type}
" http://127.0.0.1:5173/api/account
```

  `200 application/json`이어야 한다. `200 text/html`이면 프록시가 꺼진 상태다. 브랜치를 전환하면 `vite.config.ts`가 잠깐 옛 내용이 되어 Vite가 프록시 없는 설정으로 재시작할 수 있으므로, `git checkout` 뒤에는 dev 서버를 다시 시작한다.
- `/api/dashboard`는 HTTP 200 JSON으로 응답해야 한다.
- `/api/dashboard` 응답은 `data` 래퍼가 있는 봉투 구조이며 `generatedAt`, `dataAsOf`, `sourceLabel`, `isMock`, `paperOnly`, `executed`, `externalConnections`, `disclaimer`, `data`를 포함해야 한다.
- `/api/dashboard` 금액 필드는 정수, 비율 필드는 퍼센트 단위 숫자여야 한다. 포맷된 문자열(`"128,450,000원"`)이 응답에 있으면 실패로 본다.
- 보유 종목 `value` 합계가 `summary.totalAsset`과 일치해야 한다.
- 현금 행처럼 해당 없는 필드는 `"-"`가 아니라 `null`이어야 한다.
- `/api/account`의 합계 항등식이 성립해야 한다: 투자금액+현금=총자산, 실현+미실현=누적손익, 입금-출금=원금, 자산군 합계=총자산, 통화 합계=총자산.
- `/api/account`의 총자산·원금·현금·미실현손익이 `/api/dashboard`와 일치해야 한다.
- 세 에이전트 경로의 `pipeline`이 서로 같아야 하고 실행 단계 `state`가 `blocked`여야 한다.
- `POST /api/approvals/{id}/approve`, `.../reject`는 `pending`인 건만 성공하고, 이미 결정된 건을 다시 결정하면 `409`, 모르는 ID는 `404`여야 한다.
- 승인·반려 후에도 봉투 `executed`는 여전히 `false`여야 한다. 모의승인은 실제 체결을 뜻하지 않는다.
- 승인·반려는 서버 프로세스가 살아있는 동안 유지되어야 한다. 페이지를 새로고침해도 상태가 유지되는지 확인한다(클라이언트 상태가 아니라 서버 메모리에 있다는 뜻).
- 서로 다른 앱 인스턴스(테스트) 간에 승인 상태가 새지 않아야 한다.
- 모든 `capabilities[].connected`가 `false`여야 한다.
- 실행 경로의 모든 항목 `실행 결과`가 `실행 안 됨`이고 `executionGrade`가 `자동 실행`이 아니어야 한다.
- 검증 경로의 모든 항목 `출처 뒷받침`이 `미확인`이어야 한다.
- `uv run pytest` 기준 백엔드 테스트 54개가 통과해야 한다.
- 같은 결정(DEC-1042)을 승인 대기와 대시보드가 같은 상태로 보여주는지 확인한다. 한쪽에서 승인하면 다른 쪽에도(새로고침 없이) 반영되어야 한다.
- CORS origin은 `http://127.0.0.1:5173`, `http://localhost:5173`만 허용되어야 하고, `allow_methods`는 `GET`, `allow_headers`는 명시 목록이어야 한다.
- 프론트는 Vite `server.proxy`로 `/api`를 `http://127.0.0.1:8000`에 전달한다. 브라우저는 절대 URL을 직접 호출하지 않는다.

## 상호작용 검증

- 필터 선택 시 목록과 요약이 함께 갱신되는지 확인한다.
- 행 또는 카드 선택 시 우측 인스펙터가 갱신되는지 확인한다.
- 필터 변경 뒤 숨겨진 선택 항목이 우측에 남지 않는지 확인한다.
- 빈 결과 상태가 있으면 기본 링크나 이전 선택이 남지 않는지 확인한다.
- 관련 기존 화면 링크가 로컬에서 200 응답하는지 확인한다.

## 금융 안전 검증

- 화면에 `모의투자`, `화면 검토용 가상 예시`, `실제 주문 아님`, `실제 계좌·API·DB 미연결` 중 해당 화면에 필요한 문구가 보이는지 확인한다.
- 수익률, 손실, 세금, 비용, 위험, 건강 점수 등은 보장이나 실제 판단처럼 표현하지 않는다.
- 실제 주문, 실제 계좌, 실제 API, 실제 DB 연결을 암시하지 않는다.
