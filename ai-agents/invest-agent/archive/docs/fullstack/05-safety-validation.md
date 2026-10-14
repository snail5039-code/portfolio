# 안전장치와 검증 기준

기준일: 2026-08-29 KST

## 안전 설계

이번 풀스택 전환에서 가장 중요한 것은 “프론트 또는 백엔드가 생겨도 실제 금융 행동은 여전히 불가능하다”는 점이다. 현재 React/Vite `apps/web` 프론트와 `apps/api` FastAPI 최소 골격이 존재하며, 백엔드는 `GET /api/health` 단독 엔드포인트만 제공한다.

필수 안전장치:

- 외부 URL 호출 코드 금지 — **단, `app/integrations/opendart.py`, `app/integrations/kis.py`는 예외다.** 2026-09-01 사용자 승인으로 금융감독원 OpenDART 공시 API(읽기 전용, 계좌·금액 무관), 2026-09-02 사용자 승인으로 한국투자증권(KIS) **모의투자(paper trading)** API(가상계좌, 실제 자금 무관)에 한해 서버 사이드 호출을 허용한다. 다른 파일에서 외부 URL을 호출하는 코드는 여전히 금지다.
- 증권사·시세·환율 API 키 환경변수 금지. **`OPENDART_API_KEY`와 `KIS_PAPER_APP_KEY`/`KIS_PAPER_APP_SECRET`/`KIS_PAPER_CANO`/`KIS_PAPER_ACNT_PRDT_CD`(전부 `apps/api/.env`, git 미포함)는 예외다** — 전자는 공시 조회 전용, 후자는 KIS 자신이 관리하는 모의투자 가상계좌 전용이며 실전투자(실제 자금) 앱키·계좌와는 다른 값이다.
- **`app/integrations/kis.py`는 실전투자 도메인(`openapi.koreainvestment.com`)이나 그 주문 tr_id(`T`/`J`/`C`로 시작, 예: `TTTC0012U`)를 코드에 포함할 수 없다.** 이 파일이 호출하는 도메인은 언제나 모의투자 전용 `openapivts.koreainvestment.com`이어야 하고, 주문 tr_id는 언제나 `V`로 시작해야 한다(예: `VTTC0012U`). 이 제약이 깨지면 실전 주문 오발송 위험이 생기므로 다른 어떤 사유로도 예외를 두지 않는다.
- 실제 주문처럼 보이는 서비스명 금지, 승인 처리는 `MockApprovalService` 같은 명명으로 제한
- 백엔드 응답에 `executed: false`, `paperOnly: true` 포함. `executed`는 승인이 KIS 모의투자로 실제 주문을 전송한 경우에도 `false`로 유지한다 — 그 계좌가 가상계좌이기 때문이지, 주문이 전송되지 않아서가 아니다(`app/schemas/common.py`의 `FixtureEnvelope` 참고). `externalConnections`는 기본 `0`이고, 기업 상세 화면이 OpenDART 공시를, 대시보드·승인 대기 화면이 KIS 모의투자 잔고·주문을 실제로 받아온 요청에 한해서만 `1`을 허용한다(다른 모든 화면은 여전히 `0` 고정).
- 화면과 응답 모두에 `isMock: true` 포함
- 실제 투자 권유, 수익 보장, 손실 회피 보장 표현 금지
- 프론트의 백엔드 호출은 Vite `server.proxy`를 거친 같은 출처 상대 경로 `/api/*`로만 한다
- 프론트 클라이언트는 응답의 `isMock`, `paperOnly`, `executed`, `externalConnections`(허용 목록 기준, 기본 `[0]`)를 확인한 뒤에만 화면에 사용한다
- 23개 화면 전부와 `GET /api/health`가 구현됐다(현재 상태는 `docs/handoff/01-current-state.md` 기준)

## 금지 문자열 점검 대상

```text
fetch("https://
axios.get("https://
WebSocket
Broker
openapi.koreainvestment.com  (실전투자 도메인 — openapivts.* 모의투자 도메인만 허용)
TTTC / JTTC / CTTC로 시작하는 tr_id  (실전투자 tr_id — V로 시작하는 모의투자 tr_id만 허용)
real order
live trading
```

단, 문서의 안전 설명 문맥, `app/integrations/opendart.py`(및 이를 부르는 `app/routers/company_detail.py`, `app/config.py`)의 `https://opendart.fss.or.kr` 호출, `app/integrations/kis.py`(및 이를 부르는 `app/routers/dashboard.py`, `app/routers/approvals.py`, `app/config.py`)의 `https://openapivts.koreainvestment.com` 모의투자 호출은 예외로 본다. 그 외 파일에서 이 문자열들이 나오면 실패로 본다.

## 검증 기준

풀스택 전환 작업마다 다음을 확인한다.

- 프론트 빌드 통과
- 백엔드 테스트 통과
- `/api/health` HTTP 200 JSON 응답 확인
- `/api/dashboard` HTTP 200 JSON 응답과 봉투 안전 필드 확인
- 핵심 화면 1440×900 렌더링 확인
- 콘솔 오류 없음
- 네트워크 요청이 로컬 백엔드로만 향함 (모든 요청 호스트가 `127.0.0.1:5173`)
- 백엔드 다운 상태에서 화면이 오류 안내와 재시도를 보여주고, 이전 데이터를 그대로 남기지 않음
- 실전투자 증권사 API, 실제(비가상) 계좌, DB 운영 연결 없음. OpenDART 공시 조회(기업 상세 화면), KIS 모의투자 잔고·주문(대시보드·승인 대기 화면)만 예외적으로 실제 외부 연결이며, 이 경우 응답이 각각 `filingsConnected: true`·`holdingsConnected: true`/`kisOrderNo`·`externalConnections: 1`로 정직하게 표시하는지 확인한다. KIS 쪽은 추가로 도메인이 `openapivts.koreainvestment.com`(모의투자)인지, tr_id가 `V`로 시작하는지 확인한다
- 안전 문구가 화면과 응답에 유지됨

## 완료 판정 원칙

중대 또는 높은 문제가 남아 있으면 완료 처리하지 않는다. 검증 결과가 실패 또는 조건부 통과이면 관리자가 재작업 범위를 정하고 다시 검증한다.
