# 진행 상황 · 이어서 하기

마지막 갱신: 2026-10-10 · **기본 개발 완료** (1~5단계, 평가, KB 연결 코드). 남은 것: 장중 재확인(자동 매도·급락 AI 매도·정정·취소·예약), KB 실전 키 연결 테스트(사용자), OpenDART 점검 후 공시 재임베딩·시장 전체 백테스트, 6단계 공개 배포(법률 확인 뒤). 단계별 기록은 [12-todo-by-stage.md](12-todo-by-stage.md), 현재 요약은 [README](../../README.md). 아래 2~4장은 2026-10-07 기준이라 일부 낡았다

새 대화(세션)에서 이어서 작업할 때 이 문서부터 읽는다. 단계별 상세 기록은 [08-dev-order.md](08-dev-order.md)의 "완료 기록"에 있다.

## 1. 새 세션에서 처음 할 일

1. [AGENTS.md](../../AGENTS.md)(작업 규칙)와 이 문서를 읽는다
2. [12-todo-by-stage.md](12-todo-by-stage.md)에서 다음 할 일(위에서부터 안 끝난 것)을 보여준다. 고른 일의 참고 문서([08-dev-order.md](08-dev-order.md), [11-rag-expansion.md](11-rag-expansion.md) 등)를 읽는다
3. 계획을 사용자에게 보여주고 동의를 받은 뒤 구현한다 (AGENTS.md 2장)
4. 푸시·외부 전송·설치·약관 동의·비용 생기는 일은 **매번** 먼저 묻는다
5. **답은 항상 한국어로** 한다 (영어로 답했다가 여러 번 지적받음)

## 2. 단계별 상태

| 단계 | 내용 | 상태 | 커밋 |
|---|---|---|---|
| 1 | 정리(archive) + 서버 뼈대(DB, 마이그레이션) | ✅ | `f627bd3`, `c8d86b4` |
| 2 | 로그인 · 성향 퀴즈(8문항) · 일반/맞춤 모드 · 투자 정책 API | ✅ | `5dd17cc`, `d24a5b8` |
| 3 | LangGraph 대화 그래프 · 조회(잔고·시세·주문내역) · SSE · 체크포인트 | ✅ | `66345dc`, `b67a0af`(속도 1.4~1.8초) |
| 4 | 투자 AI ↔ 검증 AI 분석 · 30종목 데이터 수집 · 지표 | ✅ | `6ef5516`, `c3a6640`, `29b817d`, `0461808`, `91a391c` |
| 5 | 주문 그래프: 처리안 → 승인 → 폰 실행(execute) → 기록, 승인·기록 API | ✅ | `70ed1e3` |
| — | 개발 환경: Flutter, Android SDK, 에뮬레이터 설치 | ✅ | `51832f9` |
| 6 | Flutter 앱 뼈대: 화면 8종, 대화·멈춤 처리, 가짜 증권사 | ✅ | `2623ba3` + 마무리 |
| 7 | 증권사 연결 (KIS 모의 주문, KB 조회) | 🔶 KIS 모의 주문·체결·체결 갱신 완료 (2026-10-07), KB 조회 남음 | `e88fdd1`, `87941ce`, `9f50187` |
| 8 | 웹 · 기록 화면 · 마무리 · 평가 | 🔶 기록 화면·체결 질문·웹 배치·디자인 H안 완료, 평가는 마지막에 | `29e6203`, `4558e80`, `4fd80b8`, `b12c5e7` |

서버 테스트 250개 통과, Flutter 테스트 22개(`apps/client`에서 `flutter test`) 통과 + 실제 Gemini 확인 11개(`-m gemini`).

## 3. 지금 서버가 할 수 있는 것 (`apps/api`)

| 기능 | API · 코드 |
|---|---|
| 가입·로그인(토큰 14일)·로그아웃·탈퇴(비밀번호 재확인) | `routers/auth.py` |
| 성향 퀴즈 8문항, 일반 모드(퀴즈 안 함: 정보만, 안정형 한도), 투자 정책·수수료율 | `routers/policy.py`, `functions/profile.py` ([09-investor-profile.md](09-investor-profile.md)) |
| 대화: `POST /api/chat`, `POST /api/chat/resume`(SSE), `GET /api/chat/pending` | `routers/chat.py`, `agents/graph.py` |
| 조회: 잔고·시세(앱은 fetch 멈춤, 웹은 스냅샷·최근 종가)·오늘 주문 내역 | `agents/query.py` |
| 분석: "삼성전자 사도 돼?" → 투자 AI 제안서(출처 ID) → 코드 검사 + 검증 AI(원문 다시 읽기) → 반박-수정 최대 2번 | `agents/analysis.py` |
| 주문: "SK하이닉스 4주 사줘" → 정책 검사(코드) → 처리안(approval) → execute(앱만) → 기록. 분석에서 "이대로 주문할까요?"로도 이어짐 | `agents/order.py`, `functions/orders.py` |
| 승인 대기·기록 | `GET /api/approvals?status=`, `/api/approvals/{id}`, `/api/history`, `/api/history/{id}` |
| 내 기록 질문 ("이번 달에 뭐 샀지?", "왜 반려됐지?"): DB 기록으로 답, LLM은 분류만 | `agents/history.py` |
| 계좌 스냅샷(폰이 올림, 계좌번호 없음) | `routers/snapshot.py` |
| 아침 브리핑(보유 종목 공시·오늘 한도·검증 거친 매수 제안). 수동 `python -m app.briefing`, 자동 `.env` `MORNING_BRIEF_TIME` | `app/briefing.py`, `GET /api/briefings/latest` |
| 장 마감 요약(LLM 없음, 기본 15:40 `CLOSE_SUMMARY_TIME`) + AI 회고·내일 계획(투자 AI → 검증 AI, 주문 없음, 기본 꺼짐 `CLOSE_REVIEW_TIME`, 수동 `python -m app.review`) | `app/briefing.py` `build_close`, `app/review.py`, `GET /api/briefings/latest?kind=close` |
| 체결 갱신(폰이 KIS 주문 내역으로 올림)·홈 링(오늘 주문 금액·1일 한도·규칙에 걸린 요청 없는 날) | `GET /api/orders/open`, `POST /api/orders/fills`, `GET /api/orders/today` (`routers/orders.py`) |
| 데이터 수집: 코스피 시총 상위 100 + 코스닥 50(우선주 제외) 종가·재무·공시 본문 임베딩(약 1.3만 조각), 바뀐 것만, 종목 위험등급(1등급 판별), 서버가 매일 15시 자동 | `app/collect.py` |

앱(`apps/client`, Flutter, 디자인 H안 = 메신저 + 링): 탭 채팅(링 요약·보유 종목·대화방: 투자 비서/처리안/코치/종목)·오늘(링·계좌)·기록·더보기(처리안 모아보기·설정), 로그인·퀴즈·처리안 상세·증권사 연결. 넓은 화면(웹)은 왼쪽 메뉴 + 대화방 목록 + 대화(+처리안 패널). 디자인 후보 캔버스: https://claude.ai/artifact/UE2bH5mfGE7udTJnZH7oD8 (비공개). 증권사: KIS 모의(`broker/kis_mock_broker.dart`)로 실제 주문·체결 확인. 개발 키는 `apps/client/dev_keys.env`(git 제외, 양식 `dev_keys.example.env`)를 `--dart-define-from-file=dev_keys.env`로 넘긴다. 키가 없으면 디버그 빌드는 가짜 증권사를 쓴다.

API 형식: [06-api-spec.md](06-api-spec.md). 멈춤 4종류 `question` / `fetch` / `approval` / `execute`의 형식은 06 문서 3장과 `agents/interrupts.py`.

## 4. 실행 방법

```bash
docker start invest-db
```
(재부팅 후 Docker Desktop이 꺼져 있으면 먼저 켠다: `C:\Users\snail\AppData\Local\Programs\DockerDesktop\Docker Desktop.exe`)

```bash
uv --directory apps/api run python -m app.migrate
```

```bash
uv --directory apps/api run uvicorn app.main:app --port 8000
```

```bash
uv --directory apps/api run pytest
```

앱 (Android 에뮬레이터, 서버는 `10.0.2.2:8000`으로 접속):

```bash
cd apps/client && flutter run -d emulator-5554 --no-enable-impeller --dart-define-from-file=dev_keys.env
```

웹 (`.claude/launch.json`의 `web`, http://localhost:5000): `.env`에 `CORS_ORIGINS=http://localhost:5000` 필요

- 비밀값은 `apps/api/.env`에만 있다 (git 제외): `DATABASE_URL`, `GEMINI_API_KEY`, `OPENDART_API_KEY`, `DATA_GO_KR_API_KEY`. 값을 출력하지 않는다
- Flutter: `C:\Users\snail\dev\flutter` (사용자 PATH 등록됨, 새 터미널부터 `flutter` 사용 가능)
- Android SDK: `C:\Users\snail\dev\android` (`ANDROID_HOME`), 가상 폰 `invest_phone`:

```bash
%ANDROID_HOME%\emulator\emulator.exe -avd invest_phone
```

## 5. 주요 결정 (이미 정함, 다시 묻지 않음)

- B 구조: 증권사 키·주문은 폰에만. 서버는 키를 받지 않는다. 기본 모의투자 (KIS 모의, `broker=kis_mock`, `mode=mock`)
- Gemini `gemini-3.6-flash`, 요청 이해는 한 번 호출(`understand`, `thinking_level=minimal`), 투자·검증 AI는 `low`
- 성향: 퀴즈 8문항, 일반 모드는 정보만·안정형 한도·올리기 불가, 퀴즈 하루 3회·유효 24개월, 19세 미만 거부
- 매수 제안 범위: 2등급(국내 주식)은 위험중립형(3단계)부터 (완화안). 변동성 규칙은 60일 변동성의 **분석 대상 안 순위** (위험중립형 하위 1/3, 적극투자형 상위 20% 제외, 공격투자형 제한 없음)
- 직접 지시한 주문은 검증 AI가 반려해도 막지 않고 "확인 필요"(`confirm_risk`)로 확인받는다. 정책 위반은 항상 막는다
- 주문: 분석 대상 30종목만, 지정가(없으면 현재가), 장 시간 휴장일 제외 평일 09:00~15:30, 승인 만료 10분, 가격 변동 1%, 매도 세금 0.20%
- 시세 출처: 금융위원회_주식시세정보 **V2 주소** (`GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2`). 예전 주소는 새 키를 거부함

## 6. 알려진 한계 · 남은 일

- 휴장일은 2026년 한국거래소 발표분만 들어 있다 (`functions/orders.py` `KRX_HOLIDAYS`). 2027년은 12월 발표 뒤 추가
- 투자주의·관리종목(1등급) 데이터 없음 → 모두 2등급
- 계좌 크기 비례 한도 (나중에)
- 체결 갱신은 폰이 열릴 때·대화를 보낼 때만 한다 (`syncFills`). 웹에서 물으면 폰이 마지막으로 확인한 값
- 순이익은 비지배지분 포함, 시세는 하루 늦은 값
- 분석 대상 확장 계획: [10-coverage-expansion.md](10-coverage-expansion.md)
- 검색 근거(RAG) 확장 계획 — 뉴스·투자 용어·내 기록: [11-rag-expansion.md](11-rag-expansion.md)
- 로그인 실패 제한은 서버 메모리에 둔다 (이메일 5번·접속 주소 20번/15분). 서버를 여러 대로 늘리면 DB·Redis로
- ERD·S-03 퀴즈 화면 그림이 옛날 기준 (원본 `.mmd`는 최신)
- 키 3개가 이전 대화 기록에 남음 → 공개 배포 전 재발급 권장

## 7. 개발 환경 상태 (2026-10-07)

- 테스트 계정 `app6@test.local` (개발 DB). 비밀번호는 채팅·저장소에 없음 → 필요하면 새 계정을 만든다
- KIS 모의계좌·Open API: 현재 HTS 아이디로 재신청 완료, 키는 `apps/client/dev_keys.env`에 있음 (값 출력 금지). 모의 잔고 약 977만 원 + 기아 2주
- 에뮬레이터 `invest_phone`: PIN 잠금 설정됨 (사용자가 직접). NDK 28.2·CMake 설치됨
- 서버 `.env`에 개발용 `MARKET_CLOCK=10:00`, `CORS_ORIGINS=http://localhost:5000`

## 8. 할 일 목록

단계별 체크리스트는 **[12-todo-by-stage.md](12-todo-by-stage.md)** 에 있다. 위에서부터 하나씩 진행하고, 끝나면 `[x]`와 커밋 번호를 적는다.

## 9. 작업할 때 주의 (겪은 것)

- 재부팅하면 Docker Desktop이 꺼져 있다 → DB 연결 실패·테스트 멈춤. 먼저 켠다
- Windows Git Bash의 `curl`은 한글 JSON 본문을 깨뜨린다 → API 수동 확인은 Python `httpx` 스크립트로
- Python heredoc으로 파일을 고칠 때 `"\n"`, `\U`가 실제 줄바꿈·이스케이프로 바뀌는 문제가 있었다 → 파일 수정은 Edit 도구 사용
- 주문 장 시간 검사는 실제 시계를 쓴다 → 장이 닫힌 시간에 실제 확인할 때는 테스트처럼 `app.clock.now`를 고정한다
- 에뮬레이터에서 Impeller(기본 그래픽)로 그리면 탭을 바꿔도 본문이 이전 화면으로 남는 현상이 있다 (앱 문제 아님). `--no-enable-impeller`로 실행하거나, 설치한 앱은 `adb shell am start -n com.investagent.invest_client/.MainActivity --ez enable-impeller false`
- KIS 연결 점검: `python tools/kis_mock_check.py` (90070000이면 HTS 아이디 변경 등 KIS 계정 연결 문제 → 모의투자·Open API 재신청). 에뮬레이터에는 PIN 잠금이 있어야 주문 전 잠금 확인이 된다
- 에뮬레이터 화면 조작은 `adb shell input tap/text` (한글 입력은 안 됨 → 추천 질문 칩을 누른다). 생체인증·PIN 화면은 캡처하면 검게 나온다 (사용자가 직접 입력)
- Flutter 화면에서 `setState(() => _x = _load())`처럼 Future를 돌려주면 오류가 나고 화면이 갱신되지 않는다 → `setState(() { _x = _load(); })`
- KIS 모의: 토큰 발급은 1분에 1번, 초당 호출 수가 적다 ("초당 거래건수 초과")
- 장이 닫힌 시간에 주문 흐름을 확인하려면 `.env`에 `MARKET_CLOCK=10:00` (주말·휴장일이면 직전 거래일로 봄, 운영에서는 비운다). 테스트는 이 값을 무시한다
- 테스트는 `invest_test` DB를 새로 만들어 쓴다 (개발 DB `invest`는 안 건드림). Gemini는 가짜로 바꿔 끼워 비용 0
