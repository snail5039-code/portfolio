# 개발 순서

작성일: 2026-10-04 · 기준 문서: [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md) 5장 MVP

MVP를 8단계로 나눠 만든다. 증권사 키 없이 할 수 있는 것부터 하고, 키는 7단계에서야 필요하다.

## 진행 방법

1. 단계를 시작하기 전에 그 단계의 **참고 문서**를 읽는다.
2. 할 일을 계획해서 사용자에게 보여주고 동의를 받는다 ([AGENTS.md](../../AGENTS.md) 2장).
3. 구현한다.
4. **완료 조건**을 확인한다 (테스트, 화면은 직접 띄워서).
5. 진행 상황 표의 ⬜를 ✅로 바꾸고, 그 단계의 "완료 기록"에 날짜와 커밋을 적은 뒤 커밋한다.
6. 다음 단계로 넘어간다.

## 진행 상황

| 단계 | 내용 | 필요한 키 | 상태 |
|---|---|---|---|
| 1 | 정리 + 서버 뼈대 | 없음 | ✅ |
| 2 | 로그인 · 성향 설문 · 투자 정책 API | 없음 | ✅ |
| 3 | LangGraph 뼈대 · 조회 | Gemini | ✅ |
| 4 | 투자 AI + 검증 AI | Gemini, OpenDART | ✅ |
| 5 | 주문 그래프 | Gemini | ✅ |
| 6 | Flutter 앱 뼈대 | 없음 | ✅ |
| 7 | 증권사 연결 | KIS 모의, KB | 🔶 KIS 모의 주문·체결 완료, KB 조회 남음 |
| 8 | 웹 · 기록 · 마무리 | 없음 | ⬜ |

---

## 1. 정리 + 서버 뼈대

**할 일**
- 기존 목업·fixture 코드와 이전 단계 문서를 `archive/`로 옮긴다 (삭제 아님)
- `README.md`를 새 방향으로 다시 쓴다
- `apps/api`에 PostgreSQL 연결 (`psycopg`)
- `migrations/*.sql` 파일과 순서대로 적용하는 실행기로 테이블 15개 생성
- `/api/health`가 DB 연결 상태도 알려준다
- 테스트는 별도 DB `invest_test`에서

**완료 조건**: 서버가 DB에 연결돼 뜨고, 테이블 15개가 생기고, 테스트 통과

**참고 문서**
- [02-architecture.md](02-architecture.md): 3장 서버 구조, 7장 개발 환경·저장소
- [07-database.md](07-database.md): ERD, 테이블, 제약조건
- [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md): 10장 아직 정할 것 6번 (기존 화면 정리)
- 개발 환경: PostgreSQL은 Docker 컨테이너 `invest-db` (`pgvector/pgvector:pg18`), 접속 정보는 `apps/api/.env`

**완료 기록**: 2026-10-04 · 커밋 `f627bd3`(archive 이동), 그다음 커밋(서버 뼈대)
- 옮긴 곳: `archive/mockup`, `archive/web`, `archive/api-fixture`, `archive/docs`, `archive/ideas`
- DB 접근은 psycopg, 마이그레이션은 SQL 파일 + `app/migrate.py` ([07-database.md](07-database.md) 5장)
- 테이블은 ERD대로 15개 (처음 적은 14개는 잘못 센 것)
- 서버의 `.env.example`에서 KIS 키 항목을 지웠다 (서버는 증권사 키를 받지 않음)
- 임베딩 크기와 벡터 인덱스는 4단계에서 정한다

---

## 2. 로그인 · 성향 설문 · 투자 정책 API

**할 일**
- 회원가입·로그인 (비밀번호 해시, 토큰), 내 정보, 탈퇴 (데이터 삭제)
- 성향 설문 제출 → 성향 단계(1~5) → 정책 기본 한도
- 투자 정책 조회·수정 (성향보다 높으면 경고), 수수료율 입력

**완료 조건**: API 테스트 통과 (잘못된 입력, 한도 범위, 탈퇴 시 삭제 포함)

**참고 문서**
- [01-requirements.md](01-requirements.md): FR-01 ~ FR-04, FR-07 ~ FR-07b, NFR-03
- [06-api-spec.md](06-api-spec.md): 1장 목록 (계정, 성향·정책), 5장 예시
- [07-database.md](07-database.md): `users`, `investor_profiles`, `policies`
- [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md): 6장 사용자 성향 분석
- 정해야 할 것: 로그인 방식 (기획서 10장 7번), 설문 문항

**완료 기록**: 2026-10-04 · 2단계 커밋
- 로그인: 이메일·비밀번호 (소셜 로그인은 6단계 공개 배포 때 다시 정함). 비밀번호는 `hashlib.scrypt`, 토큰은 무작위 값의 sha256만 `sessions`에 저장, 14일 유효, 로그아웃 시 폐기
- 탈퇴는 비밀번호를 다시 확인한다
- 설문 5문항(1~5점) → 합계로 5단계, 손실 문항 점수 + 1 단계를 넘지 않음. 문항과 단계별 기본 한도는 `apps/api/app/functions/profile.py` (2~5단계 한도는 임시값)
- 한도가 성향 기본값보다 높으면 저장하고 경고. 설문을 다시 하면 한도는 내려가기만 한다
- 수수료율 `fee_rate_pct` 추가, 비어 있으면 미입력
- 미룸: 로그인 시도 횟수 제한(6단계 전), 비밀번호 찾기·변경, 이메일 인증
- **2026-10-04 보완**: 조사(증권사 준칙, 연구) 후 5문항 설문을 **퀴즈 8문항**으로 바꾸고 **일반 모드**(퀴즈 안 함: 정보만, 안정형 한도, 올리기 불가)를 추가. 19세 미만 거부, 65세 이상 표시, 유효기간 24개월, 하루 3회, 모순 답 안내. `003_quiz_modes.sql`, `DELETE /api/profile`. 정책은 가입할 때 만들어진다(설문 전 409 없음). 규칙과 근거: [09-investor-profile.md](09-investor-profile.md)

---

## 3. LangGraph 뼈대 · 조회

**할 일**
- 공유 State, supervisor(요청 분류), 조회 그래프
- 멈춤(interrupt) 4종류 처리 틀: `question` / `fetch` / `approval` / `execute`
- 대화 API: `POST /api/chat`, `POST /api/chat/resume` (이벤트 스트림), `GET /api/chat/pending`
- 체크포인트 `PostgresSaver`
- 웹 요청이면 `fetch` 대신 계좌 스냅샷 사용 (`POST/GET /api/snapshot`)
- State에 성향 정보 `mode`(general/custom), `risk_level`, `flags`를 넣는다 ([09-investor-profile.md](09-investor-profile.md) 5장)

**완료 조건**: "잔고 보여줘" → `fetch` 멈춤 → 가짜 잔고로 이어서 답. 서버를 재시작해도 멈춘 업무가 남아 있음

**참고 문서**
- [04-graph-design.md](04-graph-design.md): 1장 전체 그래프, 2장 멈춤 4종류, 3장 조회 그래프, 7장 State, 9장 노드 목록
- [06-api-spec.md](06-api-spec.md): 2장 대화와 멈춤 흐름(SSE), 3장 멈춤 형식
- [02-architecture.md](02-architecture.md): 2장 서버가 지휘하고 폰이 증권사 일을 한다, 웹에서 대화할 때
- [01-requirements.md](01-requirements.md): FR-08 ~ FR-13, NFR-06 ~ NFR-08
- [09-investor-profile.md](09-investor-profile.md): 2장 일반·맞춤 모드, 5장 3단계
- 참고 코드: `virtual_bank_agent`의 `src/agents/supervisor`, `src/state.py`, `web/bank/main.py` (thread_id, Command resume)

**완료 기록**: 2026-10-05 · 3단계 커밋
- 그래프: understand → 조회 그래프(find_stock → get_market(fetch 또는 스냅샷) → make_answer / read_orders). 분석·주문·결과는 "준비 중" 안내
- LLM(Gemini `gemini-3.6-flash`)은 understand(요청 이해) 한 곳만. 답 문장·금액·기준 시각은 코드가 만든다
- 멈춤 답은 그래프에 넣기 전에 검사: 지금 멈춘 `interrupt_id`만(409), 형식 엄격·계좌번호 칸 거부(422), fetch는 앱만(403). 폰 조회 실패는 가짜 값 없이 실패 안내
- 체크포인트 `PostgresSaver` (테이블은 LangGraph가 `checkpoint*`로 직접 만듦). DB 주소는 State가 아닌 실행 Context로 넘겨 체크포인트에 남지 않게 함
- 같은 대화에 새 메시지가 오면 멈춘 업무는 버리고 새로 시작한다
- 테스트 110개 (가짜 LLM, 비용 0) + 실제 Gemini 확인 14개 (`uv run pytest -m gemini`, 기본 제외). 실제 서버를 껐다 켜도 멈춘 업무가 남고 이어서 진행되는 것 확인
- **속도 개선 (같은 날)**: 처음엔 단순 조회 6.8~9.7초로 3초 목표(NFR-12) 미달. rewrite·classify·extract_query를 `understand` 한 번의 호출로 합치고 Gemini 생각 단계를 `thinking_level=minimal`로 낮춤 → 실제 서버 1.4~1.8초 (서버 시작 직후 첫 요청 2.8초). 측정: 3.6-flash 기본 2.16초, minimal 1.38초, 3.5-flash-lite 1.06초, 3.1-flash-lite 0.91초 (문장 6개 모두 정답). 모델은 3.6-flash 유지
- 종목 목록(`stocks`)은 4단계에서 채우므로, 지금 실제 서버의 "삼성전자 얼마야?"는 "종목을 찾지 못했어요"로 답한다 (테스트는 테스트용 종목으로 확인)

---

## 4. 투자 AI + 검증 AI

**할 일**
- 분석 대상 종목 목록 (`stocks`, 시총 상위 30개)
- OpenDART 공시 수집 → 조각 나누기 → pgvector 저장 → 검색 (기존 `integrations/opendart.py` 재사용)
- 지표 계산 함수 (`functions/`): PER, 부채비율, 증감률, 변동성, 주문 후 비중
- 투자 AI 제안서, 검증 AI 판정 (structured output), 반박-수정 루프 최대 2번
- 검증 AI 독립성: 제안·근거·출처 ID만 전달, 원문 다시 불러오기, 다른 프롬프트
- **일반 모드 답변 규칙**: 판단("사세요/마세요") 없이 정보·분석만. 프롬프트와 검증 AI 검사 둘 다에
- 표시 값 처리: `no_buy_proposals`면 매수 제안 금지, `vulnerable`이면 불리한 점 먼저, `high_interest_debt`면 빚 먼저 안내, `quiz_missed`면 개념 설명
- 종목 위험등급(국내 주식 2등급, 투자주의·관리종목·해외·레버리지 ETF 1등급)과 성향 비교를 검증 AI `risk_fit`에

**완료 조건**: "삼성전자 사도 돼?" → 출처 달린 제안서 → 독립 검증 판정. 지표 계산 테스트 통과

**참고 문서**
- [04-graph-design.md](04-graph-design.md): 4장 분석 그래프, 검증 AI의 독립성
- [05-schemas.md](05-schemas.md): 전체 (Source, Metric, Proposal, Claim, Verification, Check)
- [07-database.md](07-database.md): `stocks`, `proposals`, `verifications`, `disclosures`, `disclosure_chunks`, 공시 검색 SQL
- [01-requirements.md](01-requirements.md): FR-14 ~ FR-21, NFR-09, NFR-10
- [AGENTS.md](../../AGENTS.md): 5장 금융 정보 규칙
- [09-investor-profile.md](09-investor-profile.md): 4장 표시 값, 5장 4단계
- 참고 코드: `aim-ai-agent`의 RAG(06~10), reflection(17), 평가(10-rag-evaluation)
- 결정 (2026-10-05): 서버 시세는 금융위원회_주식시세정보(공공데이터포털), 종목 위험등급은 완화(2등급은 위험중립형부터), 반박-수정 최대 2번, 하루 분석 20회, 투자·검증 AI 생각 단계 low로 시작

**완료 기록**: 2026-10-06 완료 · 커밋 4-1 `6ef5516`, 4-2 `c3a6640`, 마무리 커밋
- 4-1 데이터 (2026-10-05): `004_market_data.sql`(stock_prices, financials, 임베딩 768차원 + HNSW), 수집 명령 `python -m app.collect`, 지표 계산 `functions/metrics.py`(PER·PBR·부채비율·전년 대비·20일 변동성·주문 후 비중, 테스트), 본문 조각 `functions/text.py`. OpenDART로 삼성전자 실제 수집 확인(재무 180줄, 공시 100건, 반기보고서 본문 60조각, 검색 동작). **공공데이터포털 키는 "등록되지 않은 서비스키"라 시세·30종목 선정은 아직 실제로 못 돌림** (테스트는 가짜 응답으로 확인)
- 4-2 분석 그래프 (2026-10-05): `agents/analysis.py` find_stock → check_target(대상·하루 20회) → get_account(앱 fetch: 잔고+현재가 / 웹: 스냅샷) → gather(출처 ID: `dart:`, `dart:#조각`, `fin:`, `price:`, `quote:`, `snapshot`, 지표 계산) → invest_agent → verify_agent(코드 검사 먼저 → 인용한 출처만 DB에서 다시 읽고 지표 다시 계산 → 검증 AI) → 반려면 최대 2번 수정 → record(`proposals`, `verifications`). 성향 규칙(`functions/suitability.py`)은 코드가 지킨다: 허용 밖 행동은 '관찰'로. `005_analysis.sql`(metrics, conditions, disagreements 칸)
- 실제 Gemini 확인: 삼성전자 분석 13.5초(요청→fetch 3.1초, 이후 10.4초), 출처 달린 제안서와 승인 판정. 근거의 "메모리 평균 판매가격 약 220% 상승"을 원문에서 확인. 영업이익 증가율을 일부러 틀리게(33.23%→50%) 넣은 제안서를 검증 AI가 반려하고 정확한 값을 지적
- 4-3 마무리 (2026-10-06): 시세 API가 V2 주소(`GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2`)로 바뀌어 있어 고침 (예전 주소는 새 키를 "등록되지 않은 서비스키"로 거부). 30종목 전체 수집 6분 37초 (2026-10-01 종가 기준, 종목당 65일, 본문 조각 약 3,500개). SK하이닉스 실제 분석 11.1초, PER 31.18배·PBR 11.10배·20일 변동성 57.73% 등 모든 지표 계산, 승인 판정
- 보완 (2026-10-06, 5단계 전):
  - 분석 대상 30종목은 OpenDART에 회사가 있는 종목 중에서 고른다 → 우선주(삼성전자우) 제외
  - 지표 기준을 최근 정기보고서로: PER = 시가총액 ÷ 최근 4개 분기 순이익(작년 연간 + 올해 누적 − 작년 같은 기간 누적), PBR·부채비율 = 최근 보고서 기말, 매출·영업이익 증감 = 올해 누적 vs 전년 같은 기간 누적 (`006_financials_cumulative.sql`). SK하이닉스 PER 31.18배(작년 연간) → 8.26배(최근 4개 분기)
  - 서버가 매일 15시(KST, `AUTO_COLLECT_HOUR`, "off"면 끔)에 자동 수집
  - 웹 시세 질문은 서버의 최근 종가로 답한다
  - 변동성 규칙(코드): 60일 변동성의 분석 대상 안 순위로 매수 제안 제한 (위험중립형 하위 1/3, 적극투자형 상위 20% 제외, 공격투자형 제한 없음). 이유를 투자 AI와 사용자에게 알린다
  - 임시값 확정: 퀴즈 B2는 2008년 실제 손실 사례로, 성향별 금액 한도는 지금 값으로 확정 (계좌 비례 한도는 5단계에서 검토)
- 알려진 한계: 순이익은 비지배지분 포함. 투자주의·관리종목(1등급) 데이터가 없어 모두 2등급으로 본다. 시세는 하루 늦은 값

---

## 5. 주문 그래프

**할 일**
- 주문 값 뽑기·검사 (빠진 값 질문, 후보 고르기, 불가능 안내)
- 정책 검사 (코드): 1회·1일 한도, 종목 비중, 현금, 장 운영 시간
- 처리안 카드, 승인·거절·수정·만료(10분), `execute` 멈춤, 가격 재확인 결과 처리
- 기록 저장 (`record` 노드 한 곳에서만), 중복 주문 방지 (`idempotency_key`)
- 승인 대기 API, 기록 API
- **행동 코치 규칙** (`functions/`, AI 없이 계산): 잦은 매매(7일 안 3번째), 급등 추격(`chases_hot_stocks`면 한 번 더 확인), 비중 80% 넘으면 분산 안내, 처분효과 안내
- **성향보다 위험한 주문 확인 절차**: 일반 모드이거나 성향보다 위험한 종목을 직접 지시하면 위험을 보여주고 확인을 받은 뒤 진행, `audit_logs`에 기록

**완료 조건**: "SK하이닉스 4주 사줘" → 처리안 → 승인 → `execute` 멈춤 → 가짜 체결 결과로 기록까지. 정책 위반·중복 주문 테스트 통과

**참고 문서**
- [04-graph-design.md](04-graph-design.md): 5장 주문 그래프, 승인·주문 상태 변화, 8장 분기 조건
- [05-schemas.md](05-schemas.md): 6장 PolicyResult, 7장 ApprovalCard, 8장 ExecuteRequest·ExecutionResult
- [06-api-spec.md](06-api-spec.md): 3장 `approval`·`execute` 형식, 4장 폰 주문 실행 과정
- [07-database.md](07-database.md): `policy_checks`, `approvals`, `orders`, `audit_logs`, 오늘 주문 금액 SQL
- [01-requirements.md](01-requirements.md): FR-22 ~ FR-30, FR-35, FR-36
- [09-investor-profile.md](09-investor-profile.md): 5장 5단계 (행동 코치, 확인 절차)
- 참고 코드: `virtual_bank_agent`의 이체 그래프 (값 뽑기 → 검사 → 처리안 → 승인 → 실행 직전 재검사)
- 결정 (2026-10-06): 직접 지시한 주문을 검증 AI가 반려하면 막지 않고 "확인 필요"로 확인받은 뒤 진행 (정책 위반은 항상 막음). 주문은 분석 대상 30종목만. 지정가(말하지 않으면 현재가, 웹은 최근 종가), 시장가 없음. 장 시간 평일 09:00~15:30 (공휴일은 아직 거르지 않음). 만료 10분, 가격 변동 1%. 급등 = 최근 5거래일 상승률이 대상 중 상위 10%. 계좌 비례 한도는 나중에. 매도 세금 0.20% (2026년 코스피: 증권거래세 0.05% + 농특세 0.15%)

**완료 기록**: 2026-10-06 · 5단계 커밋
- `agents/order.py`: find_stock → check_target → order_values(빠진 매수·매도·수량 질문) → get_account → set_price → 가벼운 분석(gather → 투자 AI 경고 위주 → 검증 AI) → policy(코드) → blocked 또는 prepare_approval → approval → execute → 기록. 분석에서 "이대로 주문할까요?" → 예 → 수량 질문 → 정책 검사 (AI 다시 안 부름)
- `functions/orders.py`: 금액, 수수료(수수료율 미입력이면 표시), 매도 세금, 장 시간, 정책 검사(1회·1일·현금·보유 수량·비중·계좌 정보), 행동 코치(잦은 매매·급등 추격·비중 집중·처분효과), 가격 변동 판단
- 처리안 카드(`approvals.card`, `007_orders.sql`): 금액·수수료·세금·주문 후 비중·최악의 경우·검증 판정·의견 차이·정책 결과·경고·확인 필요·만료 시각
- 확인 필요(승인 때 `confirm_risk: true` 필수): 일반 모드, 성향보다 위험(등급·변동성 순위), 검증 반려·사용자 판단 필요, 급등 추격 성향 + 급등
- 승인·거절·만료(10분)·수정("2주만"은 코드로, 그 밖은 LLM으로 읽음, 알아듣지 못하면 다시 물음)·가격 1% 넘게 변동 시 같은 처리안으로 다시 승인. 실행은 앱만(웹 승인은 "실행 필요"로 남음), `idempotency_key`가 다르면 거부, 같은 결과는 한 번만 기록
- API: `GET /api/approvals?status=needs_approval|needs_execution|closed`, `GET /api/approvals/{id}`, `GET /api/history`, `GET /api/history/{proposal_id}`(타임라인). `POST /api/chat/resume`에 `client`(지금 답하는 쪽) 추가
- 테스트 217개 (주문 23개, 계산 21개). 실제 Gemini·실제 데이터로 "SK하이닉스 1주 사줘" → 처리안(10.2초) → 승인 → execute → 가짜 체결 → 기록·타임라인 확인 (시계만 장중으로 고정, 실제 시각이 새벽이라)
- 아직: 공휴일 휴장 판별, 계좌 비례 한도, "아까 주문 체결됐어?"(결과 그래프)

---

## 6. Flutter 앱 뼈대

**할 일**
- Flutter 설치, `apps/client` 생성
- 로그인·회원가입·성향 퀴즈(가입 후 "퀴즈 / 나중에"), 홈, 대화(이벤트 스트림, 멈춤 처리), 처리안 상세, 승인 대기
- 설정: 모드(일반/맞춤), 퀴즈 다시 하기, 일반 모드로 돌아가기
- 공통: 모의투자 배지, 일반 모드 배지, 금액 표시, 상승 빨강·하락 파랑, 출처·기준 시각 표시

**완료 조건**: 앱에서 3·5단계 흐름을 가짜 증권사 데이터로 끝까지 진행

**참고 문서**
- [03-screens.md](03-screens.md): 화면 목록, 흐름, S-01 ~ S-08 와이어프레임, 공통 규칙
- [09-investor-profile.md](09-investor-profile.md): 3장 퀴즈 문항·보기 키, 5장 6단계
- [02-architecture.md](02-architecture.md): 4장 클라이언트 구조
- [06-api-spec.md](06-api-spec.md): 2장 이벤트 스트림, 3장 멈춤 형식
- 개발 환경 (2026-10-06 설치): Flutter 3.47.6, Android SDK(명령줄 도구), 에뮬레이터 `invest_phone` — [02-architecture.md](02-architecture.md) 7장. 에뮬레이터 실행: `%ANDROID_HOME%\emulator\emulator.exe -avd invest_phone`

**완료 기록**: 2026-10-06 · `2623ba3` + 마무리 커밋
- `apps/client` (Android·웹 같은 코드). 패키지는 `http`, `flutter_secure_storage` 두 개만, 상태 관리 라이브러리 없음 (Flutter 기본 `ChangeNotifier`·`setState`)
- 화면: 로그인·회원가입(가입 후 "퀴즈 하기 / 나중에"), 퀴즈 8문항·결과, 홈, 대화, 처리안 상세, 승인 대기(3칸), 설정(모드·퀴즈·일반 모드로·한도·로그아웃·탈퇴). S-09 결과는 대화에 표시, S-10·11 기록은 8단계
- 대화 로직 `features/chat/conversation.dart`: question·approval은 사용자가 답하고, fetch·execute는 앱이 자동으로 답한다. 승인 대기 화면도 같은 로직으로 멈춘 대화에 이어서 답한다. "확인 필요"가 있으면 상세 화면에서 체크해야 승인 버튼이 켜진다(`confirm_risk`)
- 가짜 증권사 `broker/fake_broker.dart`: 2026-10-01 실제 종가 고정, 현금 150만 원 + 삼성전자 3주로 시작(앱을 다시 켜면 처음 값), 가격 1% 넘게 바뀌면 `price_changed`, 같은 `idempotency_key`는 한 번만 주문. 화면에 "가짜 데이터"·"가짜 체결" 표시. 7단계에서 KIS 모의로 교체
- 시각은 기기 시간대와 상관없이 한국 시각으로 표시
- 서버: 개발용 `MARKET_CLOCK`(장 시간 검사 시각 고정, 주말이면 직전 금요일, 시작 로그 경고), 웹 개발용 `CORS_ORIGINS`. 퀴즈 모순 안내 문구를 −40%로 맞춤
- 확인: Flutter 테스트 9개(금액·시각·이벤트 스트림·가짜 주문 6가지), 서버 테스트 218개. 에뮬레이터에서 실제 서버·실제 Gemini로 로그인 → 홈(가짜 잔고, 스냅샷 전송) → "잔고 보여줘" → "기아 2주 사줘" → 처리안(일반 모드라 확인 필요) → 체크 후 승인 → 가짜 체결 → 홈 반영·승인 대기 "만료·거절"에 "주문 체결" → 퀴즈(6점 → 4단계, 일반 모드 배지 사라짐) → "삼성전자 사도 돼?" → 분석 → "주문하기" → "몇 주?" → 비중 한도로 막힘(47.42% > 40%)까지 확인
- 웹 빌드도 띄워 화면 확인 (웹은 계좌 스냅샷이 없으면 "폰 동기화" 안내)
- Android 빌드에 NDK 28.2(2.2GB)와 CMake 3.22.1 설치 (Flutter Android 빌드가 요구)

---

## 7. 증권사 연결

**할 일**
- `BrokerAdapter`: KIS 모의 어댑터(주문 검증), KB 어댑터(조회)
- 키 보안 저장소 (`flutter_secure_storage`), 증권사 연결 화면
- `fetch` 처리 (잔고·현재가), `execute` 처리 (가격 재확인 → 생체인증 → 주문 → 시간 초과 시 주문내역 조회)
- 계좌 스냅샷 서버 전송 (계좌번호 제외)

**완료 조건**: **KIS 모의계좌로 실제 주문이 접수·체결**되고 기록됨. KB 잔고·시세 조회 성공

**참고 문서**
- [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md): 9장 증권사 API 사용 방식, KB 약관 반영
- [06-api-spec.md](06-api-spec.md): 3장 `fetch`·`execute`, 4장 폰 주문 실행 과정
- [03-screens.md](03-screens.md): S-04 증권사 연결, S-07 처리안 상세, S-09 주문 결과
- [01-requirements.md](01-requirements.md): FR-05 ~ FR-06c, FR-26 ~ FR-29, NFR-01, NFR-02, NFR-04, NFR-05a
- [AGENTS.md](../../AGENTS.md): 4장 실전투자 관련 규칙 (KB 키로 주문 API 호출 금지)
- 참고 코드: `archive/api-fixture/integrations/kis.py` (KIS 모의 토큰·주문 형식), [KIS open-trading-api](https://github.com/koreainvestment/open-trading-api)
- 필요한 것: KIS 모의투자 키, KB Open API 키 (사용자 발급)

**완료 기록**: (진행 중)
- 2026-10-06 키 없이 할 수 있는 부분 완료:
  - 증권사 공통 틀 `broker/broker.dart` (잔고·현재가·주문·오늘 주문 내역)과 폰 주문 실행 `executeOrder`: 이미 실행한 주문 확인 → 현재가 재확인(1% 넘으면 `price_changed`) → 폰 잠금 확인(`local_auth`, 가짜 증권사는 건너뜀) → 주문 직전 기록 → 주문. 시간 초과·연결 끊김이면 다시 주문하지 않고 오늘 주문 내역에서 찾는다(`unknown_checked`). 앱이 주문 도중 꺼져도 같은 주문을 다시 내지 않는다
  - KIS 모의 어댑터 `broker/kis_mock_broker.dart`: 모의 서버(`openapivts`)와 모의 거래 코드(`VTTC8434R` 잔고, `VTTC0012U`/`VTTC0011U` 매수/매도, `VTTC0081R` 주문 내역)만. 접속 토큰은 폰 보안 저장소에 두고 다시 씀(발급 1분 1회 제한)
  - 키 저장 `secure/key_store.dart` (앱키·시크리트·계좌번호 12345678-01, 폰 보안 저장소만), S-04 증권사 연결 화면(연결 테스트, 저장, 삭제). 디버그 빌드는 "가짜 증권사(개발용)"도 고를 수 있음
  - Android: `FlutterFragmentActivity`, `USE_BIOMETRIC`·`INTERNET` 권한
  - 테스트: Flutter 16개 (KIS 요청 주소·거래 코드·주문 형식·잔고 변환·거절·시간 초과 후 내역 확인·잠금 거부 시 주문 안 함, 가짜 응답으로). 에뮬레이터에서 가짜 증권사로 주문 흐름과 연결 화면 확인
- 2026-10-07 **KIS 모의계좌로 실제 주문 접수·체결 확인**: 에뮬레이터에서 실제 KIS 모의 잔고(1,000만 원) → "기아 2주 사줘" → 처리안(KIS 현재가 111,400원) → 확인 체크 → 승인 → 가격 재확인 → 폰 잠금 PIN → KIS 모의 주문(주문번호 0000010734) → KIS 주문내역에서 2주 체결(평균 111,200원) 확인
  - 막혔던 것: 잔고·주문 조회가 모두 90070000 "처리계좌의 ID와 사용자정보가 상이". 원인은 **HTS 아이디 변경**. 모의투자·Open API를 지금 아이디로 다시 신청하고 키를 재발급하자 해결
  - 개발용 키: `apps/client/dev_keys.env`(git 제외)를 `--dart-define-from-file`로 넘기면 디버그 빌드에서만 폰 보안 저장소에 넣고 KIS 모의로 연결. 서버는 키를 받지 않는다
  - 점검 도구 `tools/kis_mock_check.py`: 공식 예제와 같은 순서·헤더로 토큰 → 시세 → 잔고 → 매수가능 → 주문내역 (`--order`면 모의 매수 1주)
  - 같이 고친 것: KIS 모의는 초당 호출 수가 적어 호출 사이를 0.55초 띄움, 계좌번호 8자리만 넣으면 상품코드 01
- 남은 것: KB 조회 어댑터(KB 키·문서 받은 뒤), 접수 뒤 체결 결과를 서버 기록에 갱신(지금 기록은 "접수")

---

## 8. 웹 · 기록 · 마무리

**할 일**
- Flutter Web 빌드: 주문 버튼 없음, 웹 승인은 폰의 "실행 필요"로
- 기록 화면, 기록 상세 (타임라인), 주문 결과, 설정
- 데모 시나리오 3개, Golden Set 정확도, 검증 AI 오류 주입 20개 탐지율

**완료 조건**: [INVEST_AGENT_PLAN.md](../../INVEST_AGENT_PLAN.md) 5장 "완료 기준" 3가지 충족

**참고 문서**
- [03-screens.md](03-screens.md): 웹 레이아웃, S-08 ~ S-12
- [02-architecture.md](02-architecture.md): 웹에서 대화할 때
- [01-requirements.md](01-requirements.md): FR-30, FR-35, FR-36, NFR-15 ~ NFR-17
- 참고 코드: `virtual_bank_agent`의 `evaluation/` (Golden Set, LangSmith)

**완료 기록**: (진행 중)
- 2026-10-06 기록 화면 S-10(필터 전체·체결·거절·반려·만료)·S-11(타임라인, 펼쳐서 근거·출처·검증 항목), "아까 주문 체결됐어?" 답하기(`agents/result.py`, DB 기록으로, LLM 없음)
- 같이 고친 것: 분석에서 "이대로 주문"으로 이어진 주문의 제안서 수량·가격이 비어 저장되던 버그, 한국거래소 2026 휴장일, 로그인 실패 제한(이메일 5번·접속 주소 20번/15분 → 429)
- 2026-10-06 웹 화면 배치: 폭 900px 이상이면 왼쪽 메뉴(NavigationRail) + 본문, 대화 화면은 처리안 "자세히"를 오른쪽 패널로 연다. 그 밖의 화면은 가운데 읽기 좋은 폭(820px). 폰은 그대로
- 확인: 웹(1280×800)에서 주문 → 오른쪽 패널 → 웹 승인 → "폰 앱에서 실행" 안내 → 에뮬레이터 승인 대기 "실행 필요"에서 실행 → 가짜 체결 기록 (FR-30 흐름)
- 같이 고친 버그: 목록 새로 읽기(`setState(() => _x = _load())`)가 Future를 돌려 오류가 나서 화면이 갱신되지 않던 것 (홈·승인 대기·기록·설정)
- 남은 것 (마지막에): 데모 시나리오 3개, Golden Set 정확도, 검증 AI 오류 주입 20개 탐지율


---

## 이후 확장 (MVP 다음)

- 분석 대상 넓히기: [10-coverage-expansion.md](10-coverage-expansion.md)
- 검색 근거(RAG) 넓히기 — 뉴스, 투자 용어, 내 기록: [11-rag-expansion.md](11-rag-expansion.md)
