# 계좌 · 에이전트 단계 API

기준일: 2026-09-01 KST

## 목적

`BACKEND-004`에서 추가한 4개 엔드포인트를 정리한다. 이 4개는 사이드바에 메뉴만 있고 화면이 없던 항목을 채운 것이다.

| Method | Endpoint | 화면 |
|---|---|---|
| `GET` | `/api/account` | 계좌 |
| `GET` | `/api/agents/analysis` | 분석 에이전트 |
| `GET` | `/api/agents/verification` | 검증 에이전트 |
| `GET` | `/api/agents/execution` | 실행 에이전트 |

봉투 구조와 숫자 표현 규칙은 `07-dashboard-api.md`와 같다. 금액은 정수, 비율은 퍼센트 단위이며 화면 문자열은 프론트가 만든다.

## 정적 목업과의 관계

이 4개 화면은 **정적 목업에 대응 파일이 없다**. `mockup/financial-dashboard/`의 사이드바에는 「계좌」, 「분석 에이전트」, 「검증 에이전트」, 「실행 에이전트」 항목이 있지만 전부 `href="#"` 이었고 대응 HTML이 없었다. React 쪽도 같은 상태로 `aria-disabled` 처리돼 있었다.

따라서 이 화면들은 목업 이전이 아니라 `FINANCIAL_AI_AGENT_IDEA.md`의 역할 정의를 근거로 새로 설계했다. 정적 목업은 19개 기준서로 동결하고 React에만 추가한다는 결정에 따른다.

React 네비게이션에 「실행 에이전트」가 아예 빠져 있던 누락도 함께 고쳤다. 목업 사이드바에는 있던 항목이다.

## `/api/account`

시뮬레이션 계좌의 자산 현황이다. 실제 계좌, 잔고 조회, 이체, 환전과 연결되지 않는다.

fixture 숫자는 대시보드 fixture에서 유도해 두 화면이 어긋날 수 없게 했다.

- `totalAsset`, `principal`, 현금 금액은 대시보드와 같은 값이다
- `unrealizedProfit`은 대시보드 보유 종목 `profit`의 합계다
- `realizedProfit`은 누적손익의 나머지다
- `depositTotal - withdrawalTotal`은 `principal`과 같다
- `assetClasses`와 `currencies`는 각각 합계가 `totalAsset`과 같다

### 수익률 표기

`returns[]`는 기간별로 세 값을 나눠 준다.

- `profitRate`: 기간 손익 ÷ 기간 시작 평가금액
- `netInvestmentRate`: 입출금 영향을 제외한 값
- `benchmarkRate`: 화면용 가상 벤치마크

「올해」 행은 2026-03-12 입금 12,000,000원을 포함한 기간이라 두 값이 다르다. `netInvestmentRate` 9.82%는 입금액을 기간 가중(평균 투자자본 114,836,000원)해 제외한 값이다. **입금은 수익이 아니다.** 잔고 증가분을 그대로 성과로 읽지 않도록 두 값을 나란히 표시한다.

## `/api/agents/{stage}`

분석 · 검증 · 실행은 한 파이프라인의 단계별 뷰다. 셋은 같은 응답 스키마 `AgentScreenData`를 쓰고 내용만 다르다. `pipeline` 배열은 세 응답이 동일하며, `stage` 필드가 지금 보고 있는 단계를 가리킨다.

프론트도 `AgentStagePage` 한 컴포넌트를 공유한다. 세 화면의 안전 경계 표시가 갈라지지 않게 하려는 것이다.

### 단계별 성격

- **분석**: 구조화된 투자 제안서를 만든다. 주문을 만들지 않는다. `자동 생성 주문` 지표는 `없음`이다.
- **검증**: 분석과 독립된 문맥에서 감사한다. 출처 원문 연결이 없으므로 어떤 건도 무조건 `승인`으로 나오지 않는다. 결과는 `조건부 승인`, `반려`, `사용자 판단 필요` 중 하나다.
- **실행**: 권한과 안전 조건만 다시 확인한다. 실행 등급은 `자동 실행`이 될 수 없고, 모든 항목의 `실행 결과`는 `실행 안 됨`이다.

### 안전 강제

- `AgentCapability.connected`는 `Literal[False]`다. 어떤 기능도 연결됐다고 표현할 수 없다.
- `pipeline`의 실행 단계 `state`는 `blocked`다.
- 실행 화면의 `executionGrade`는 사용자를 반드시 거치는 등급만 허용한다.
- 봉투의 `executed`는 다른 엔드포인트와 같이 `Literal[False]`다.

이 조건들은 `apps/api/tests/test_agents.py`에서 검사한다.

## 검증 포인트

- 4개 경로 모두 HTTP 200이고 `content-type: application/json`이다.
- 봉투에 `isMock: true`, `paperOnly: true`, `executed: false`, `externalConnections: 0`이 있다.
- `/api/account`의 합계 항등식이 성립한다: 투자금액+현금=총자산, 실현+미실현=누적손익, 입금-출금=원금, 자산군 합계=총자산, 통화 합계=총자산.
- `/api/account`의 총자산·원금·현금·미실현손익이 `/api/dashboard`와 일치한다.
- 세 에이전트 경로의 `pipeline`이 서로 같다.
- 모든 `capabilities[].connected`가 `false`다.
- 실행 경로의 모든 항목이 `실행 안 됨`이고 `executionGrade`가 `자동 실행`이 아니다.
- 검증 경로의 모든 항목 `출처 뒷받침`이 `미확인`이다.

## 프록시 확인 시 주의

`curl`로 상태 코드만 보면 프록시가 꺼져 있어도 통과한 것처럼 보인다. Vite dev 서버는 프록시가 없으면 `/api/*`를 SPA fallback으로 처리해 `index.html`을 **200**으로 돌려주기 때문이다.

반드시 `content-type`까지 확인한다.

```bash
curl -s -H "Accept: application/json" -o /dev/null -w "%{http_code} %{content_type}\n" http://127.0.0.1:5173/api/account
```

`200 application/json`이 나와야 한다. `200 text/html`이면 프록시가 꺼진 상태다.

`git checkout`이나 브랜치 전환으로 `vite.config.ts`가 잠깐 옛 내용이 되면 Vite가 그 시점 설정으로 재시작해 프록시가 사라질 수 있다. 브랜치를 옮긴 뒤에는 dev 서버를 다시 시작한다.

프론트 클라이언트는 이 상황에서 조용히 넘어가지 않는다. `Accept: application/json`을 보내므로 404를 받아 오류 화면을 띄우고, HTML을 받더라도 JSON 파싱 실패로 오류 처리한다.
