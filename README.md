<div align="center">

# 박의혁

### Backend & AI Agent Developer

사용자에게 실제로 닿는 서비스와, 검증 가능한 AI 워크플로우를 만듭니다.<br>
아이디어를 화면에 옮기는 데서 멈추지 않고 데이터·권한·테스트·배포까지 직접 연결합니다.

[![GitHub](https://img.shields.io/badge/GitHub-snail5039--code-181717?style=flat-square&logo=github)](https://github.com/snail5039-code)
[![Email](https://img.shields.io/badge/Email-snail5039%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:snail5039@gmail.com)

</div>

---

## 대표 프로젝트

| 프로젝트 | 해결한 문제와 구현 | 기술 · 상태 |
| --- | --- | --- |
| **[전역도우미](https://github.com/snail5039-code/jeonyeok_helper)** | 법령·조례·안내서에 흩어진 전역자 혜택을 근거와 함께 찾아 주고, 할 일 목록으로 이어 주는 에이전트입니다. 10,143조각 RAG(HyDE·재정렬·지역 필터)와 정부24·온통청년 등 공공 API를 MCP 도구로 연결하고, 답변 문장마다 원문 근거를 다시 대조합니다. 규정 검색 84문항 Hit@6 100%, 답변 평가 63문항 중 61문항 통과. | LangGraph, Gemini, pgvector, MCP, FastAPI, Next.js · **개발 중** |
| **[자연어 투자 에이전트](https://github.com/snail5039-code/financial-ai-agent)** | 투자 AI가 제안하면 검증 AI가 출처 원문을 다시 대조하고, 사용자가 승인한 주문만 사용자 폰에서 증권사로 나가는 구조입니다. 오류 주입 평가에서 틀린 제안을 평균 19.3/20 차단(오탐 0)했고, KIS 모의투자 자동매매를 매일 돌리며 판단 로직을 고치고 있습니다. | LangGraph, Gemini, FastAPI, PostgreSQL/pgvector, Flutter · **개발 중** |
| **[가상 금융 업무 에이전트](./virtual_bank_agent)** | 말로 요청한 계좌·카드 업무를 supervisor → 계좌/카드 → 세부 업무 3단 그래프로 처리합니다. 변경 업무는 본인 확인·처리안·승인(Human in the Loop)을 거친 뒤에만 저장하고, 금액·잔액은 LLM이 아닌 Python 함수로 계산합니다. Golden Set 40개로 답변(LLM Judge)·interrupt 순서·데이터 변경을 함께 채점해 LangSmith 실험에서 세 평가 모두 40/40을 받았습니다. | LangGraph, Gemini, LangSmith, FastAPI, Next.js · **로컬 실행** |
| **[출퇴근 생존일지](./commute-battle)** | 근무 기록부터 정정·휴가·재택 승인과 월 마감까지 연결한 근태 관리 시스템입니다. 임금 관련 계산을 PostgreSQL 함수에 두고 SQL 회귀 테스트 216개로 검증했습니다. | Next.js 16, Supabase, Gemini, Electron · **배포** |
| **[J·E TRACE](./J-E-Trace)** | 학생의 AI 대화와 수정 과정을 기록하고 교사가 피드백하는 교육 플랫폼입니다. 보안·권한 문제를 포함한 29단계 점검을 수행하고 백엔드 68개, E2E 45개 테스트를 구성했습니다. | React Router 7, Spring Boot 4, MySQL, OpenAI · **로컬 실행** |

> 각 수치와 상태는 해당 저장소의 README, 테스트 기록, 배포 결과를 기준으로 작성했습니다. **개발 중**인 프로젝트는 원본 저장소로 바로 연결합니다.

## 프로젝트 모아보기

### AI 에이전트 · 데이터

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [전역도우미](https://github.com/snail5039-code/jeonyeok_helper) | 전역자 혜택을 법령 근거와 함께 안내하는 RAG + MCP 에이전트 | 개발 중 |
| [자연어 투자 에이전트](https://github.com/snail5039-code/financial-ai-agent) | 제안·검증·승인을 분리한 투자 에이전트와 모의투자 자동매매 | 개발 중 |
| [가상 금융 업무 에이전트](./virtual_bank_agent) | 계좌·카드 업무를 본인 확인 → 처리안 → 승인 순서로 처리하는 LangGraph 에이전트 (터미널·웹, Golden Set 평가) | 로컬 실행 |
| [온열질환자 수 예측](./heatwave-risk-ml) | 전국 일일 온열질환자 수 예측과 분석 대시보드 | [Streamlit](https://heatwave-risk-ml-twwshgp6evhagezahawdeq.streamlit.app/) · [Web](https://web-wine-one-11.vercel.app/) |
| [J·E TRACE](./J-E-Trace) | AI 대화와 수정 과정을 남기는 교육 기록 플랫폼 | 로컬 실행 |
| [GestureOSManager](./GestureOS) | 손 제스처로 Windows 입력·PPT·그리기를 제어하는 시스템 | 로컬 실행 |
| [고객 VOC 분석 Agent](./고객_VOC_분석_Agent) | n8n으로 만든 문의 분류·감정 분석·긴급 알림 자동화 | 구현 |
| [금융 뉴스 브리핑 Agent](./금융_뉴스_브리핑_Agent) | n8n으로 만든 금융 뉴스 수집·중복 제거·요약·발송 자동화 | 구현 |

### 서비스 · 제품

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [HyukForge](./hyukforge) | 직접 만든 제품·릴리스·개발 기록을 운영하는 1인 소프트웨어 스튜디오 | [배포](https://hyukforge.vercel.app) |
| [출퇴근 생존일지](./commute-battle) | 근무시간 산정, 승인 라인, 월 마감을 갖춘 근태 관리 시스템 | [배포](https://commute-battle.vercel.app) |
| [LastCall](./lastcall) | 위치와 진료 조건으로 주변 응급실·AED를 찾는 모바일 앱 (AWS EC2 운영 후 중단) | [Android 릴리스](https://github.com/snail5039-code/lastcall/releases/tag/v1.0.0-rc4) · 서버 중단 |
| [커리마](./커리마) | 가계부·할 일·일정·PC 작업을 자연어로 처리하는 개인비서 CLI | [Windows 릴리스](https://github.com/snail5039-code/personal-financial-management/releases/tag/v1.1.0-installer) |
| [WorkLog](./WorkLog_project) | 업무 기록을 보고서·인수인계·팀 협업으로 연결하는 서비스 | 배포 전 |
| [나만의 작은 맛집](./my-little-restaurant) | 맛집 저장·리뷰·소셜 로그인 웹 서비스 | [배포](https://my-little-restaurant.vercel.app) |

학습 기록 : [AI Agent 학습 저장소](https://github.com/snail5039-code/aim-ai-agent-my) · [TIL](https://github.com/snail5039-code/TIL)

## 주로 사용하는 기술

| 영역 | 기술 |
| --- | --- |
| Backend | Java 17, Spring Boot, Python, FastAPI, Flask, MyBatis |
| Frontend | React 19, Next.js 16, TypeScript, React Router, Tailwind CSS |
| Mobile | React Native (Expo), Flutter |
| Data · AI | LangGraph, LangChain, RAG(pgvector), MCP, Gemini, OpenAI, scikit-learn, MediaPipe, OpenCV |
| Database · Infra | PostgreSQL(pgvector), MySQL, SQLite, Supabase, Firebase, Docker, AWS EC2, Vercel |
| Test · Automation | JUnit, Pytest, Playwright, LangSmith, n8n, GitHub Actions |

## 저장소 안내

각 프로젝트 폴더의 README에는 기능, 실행 방법, 기술적 결정, 현재 한계를 따로 기록했습니다.<br>
일부 폴더는 별도 저장소의 검증된 시점을 옮긴 포트폴리오 스냅샷이며, 비밀키와 환경 변수는 포함하지 않습니다.

커밋 규칙은 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)에서 확인할 수 있습니다.

---

<div align="center">

[GitHub](https://github.com/snail5039-code) · [Email](mailto:snail5039@gmail.com)

</div>
