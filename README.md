<div align="center">

# 박의혁

### Backend & AI Agent Developer

사용자에게 실제로 닿는 서비스와, **검증 가능한 AI 워크플로우**를 만듭니다.<br>
아이디어를 화면에 옮기는 데서 멈추지 않고 데이터 · 권한 · 테스트 · 배포까지 직접 연결합니다.

[![GitHub](https://img.shields.io/badge/GitHub-snail5039--code-181717?style=flat-square&logo=github)](https://github.com/snail5039-code)
[![Email](https://img.shields.io/badge/Email-snail5039%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:snail5039@gmail.com)
[![HyukForge](https://img.shields.io/badge/Studio-HyukForge-111827?style=flat-square&logo=vercel)](https://hyukforge.vercel.app)

[대표 프로젝트](#대표-프로젝트) · [전체 프로젝트](#전체-프로젝트) · [기술 스택](#기술-스택) · [폴더 구조](#폴더-구조)

</div>

---

## 이렇게 일합니다

| 원칙 | 하는 일 |
| --- | --- |
| **AI가 틀려도 안전한 구조** | 돈 · 상태가 바뀌는 일은 본인 확인 → 처리안 → 사용자 승인을 거친 뒤에만 실행하고, 금액은 LLM이 아닌 코드가 계산합니다. |
| **근거 있는 답변** | RAG 검색 결과와 도구 원문을 다시 대조해, 출처에 없는 내용은 지우거나 반려합니다. |
| **평가로 확인** | "잘 되는 것 같다"로 끝내지 않고 Golden Set · 회귀 테스트 · LangSmith 실험으로 같은 사례를 반복 채점합니다. |
| **끝까지 연결** | DB 설계, 권한, 테스트, 배포(Vercel · AWS EC2 · Docker)와 운영 중단 기록까지 직접 남깁니다. |

## 대표 프로젝트

### 1. 전역도우미 &nbsp; ![개발 중](https://img.shields.io/badge/%EA%B0%9C%EB%B0%9C%20%EC%A4%91-F59E0B?style=flat-square)

> 전역한 사람이 "나는 뭘 받을 수 있지?"를 물으면 **받을 수 있는 혜택, 법적 근거, 신청할 곳**을 찾아 할 일 목록으로 이어 주는 에이전트

![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langgraph&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![pgvector](https://img.shields.io/badge/pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-111111?style=flat-square&logo=anthropic&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)

- 법령 · 조례 · 안내서 **10,143조각 RAG** (HyDE, LLM 재정렬, 지역 필터)
- 정부24 · 온통청년 · 보훈 위탁병원 등 공공 API를 **MCP 도구**로 연결
- 답변 문장마다 도구 원문과 다시 대조하는 근거 검증 노드
- 규정 검색 84문항 **Hit@6 100%**, 답변 평가 63문항 중 **61문항 통과**

[코드 보기 →](https://github.com/snail5039-code/jeonyeok_helper)

### 2. 자연어 투자 에이전트 &nbsp; ![개발 중](https://img.shields.io/badge/%EA%B0%9C%EB%B0%9C%20%EC%A4%91-F59E0B?style=flat-square)

> "SK하이닉스 4주 사줘"처럼 말하면 **투자 AI 제안 → 검증 AI 원문 대조 → 사용자 승인**을 거친 주문만 사용자 폰에서 증권사로 나가는 앱

![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langgraph&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![pgvector](https://img.shields.io/badge/pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white)

- 검증 AI 오류 주입 평가 : 틀린 제안을 평균 **19.3 / 20 차단**, 정상 제안 오탐 **0**
- KIS 모의투자로 **AI 자동매매를 매일 운영**하며 판단 로직을 고치는 중 (수익은 아직 없음)
- 증권사 키는 사용자 폰에만 두고, 숫자는 전부 코드가 계산해 AI는 인용만

[코드 보기 →](https://github.com/snail5039-code/financial-ai-agent)

### 3. 가상 금융 업무 에이전트 &nbsp; ![로컬 실행](https://img.shields.io/badge/%EB%A1%9C%EC%BB%AC%20%EC%8B%A4%ED%96%89-64748B?style=flat-square)

> 말로 요청한 계좌 · 카드 업무를 **본인 확인 → 처리안 → 승인(Human in the Loop)** 을 거쳐 처리하는 LangGraph 에이전트

![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langgraph&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![LangSmith](https://img.shields.io/badge/LangSmith-1C3C3C?style=flat-square&logo=langchain&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white)

- supervisor → 계좌/카드 → 세부 업무 **3단 그래프**, 금액 · 잔액은 Python 함수가 계산
- Golden Set 40개로 답변(LLM Judge) · interrupt 순서 · 데이터 변경을 함께 채점 → **세 평가 모두 40 / 40**
- 터미널 버전과 FastAPI + Next.js 웹 버전

[폴더 보기 →](./ai-agents/virtual-bank-agent)

### 4. 출퇴근 생존일지 &nbsp; ![배포 중](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A4%91-16A34A?style=flat-square)

> 근무 기록부터 정정 · 휴가 · 재택 승인과 월 마감까지 연결한 근태 관리 시스템

![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)

- 임금 관련 계산을 PostgreSQL 함수에 두고 **SQL 회귀 테스트 216개**로 검증
- 승인 라인과 월 마감까지 한 흐름으로 연결

[폴더 보기 →](./services/commute-battle) · [서비스 열기 →](https://commute-battle.vercel.app)

### 5. J·E TRACE &nbsp; ![로컬 실행](https://img.shields.io/badge/%EB%A1%9C%EC%BB%AC%20%EC%8B%A4%ED%96%89-64748B?style=flat-square)

> 학생의 AI 대화와 수정 과정을 기록하고 교사가 피드백하는 교육 플랫폼

![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) ![React Router](https://img.shields.io/badge/React%20Router-CA4245?style=flat-square&logo=reactrouter&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white) ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)

- 보안 · 권한 문제를 포함한 **29단계 점검**
- 백엔드 테스트 **68개**, E2E 테스트 **45개**

[폴더 보기 →](./ai-apps/je-trace)

> 수치와 상태는 각 저장소의 README · 테스트 기록 · 배포 결과를 기준으로 적었습니다.

## 전체 프로젝트

### AI 에이전트

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [전역도우미](https://github.com/snail5039-code/jeonyeok_helper) | 전역자 혜택을 법령 근거와 함께 안내하는 RAG + MCP 에이전트 | ![개발 중](https://img.shields.io/badge/%EA%B0%9C%EB%B0%9C%20%EC%A4%91-F59E0B?style=flat-square) |
| [자연어 투자 에이전트](https://github.com/snail5039-code/financial-ai-agent) | 제안 · 검증 · 승인을 분리한 투자 에이전트와 모의 자동매매 | ![개발 중](https://img.shields.io/badge/%EA%B0%9C%EB%B0%9C%20%EC%A4%91-F59E0B?style=flat-square) |
| [가상 금융 업무 에이전트](./ai-agents/virtual-bank-agent) | 계좌 · 카드 업무를 승인 흐름으로 처리하는 LangGraph 에이전트 | ![로컬 실행](https://img.shields.io/badge/%EB%A1%9C%EC%BB%AC%20%EC%8B%A4%ED%96%89-64748B?style=flat-square) |
| [고객 VOC 분석](./ai-agents/n8n-voc-analysis) | n8n 문의 분류 · 감정 분석 · 긴급 알림 자동화 | ![구현](https://img.shields.io/badge/%EA%B5%AC%ED%98%84-64748B?style=flat-square) |
| [금융 뉴스 브리핑](./ai-agents/n8n-finance-news-briefing) | n8n 금융 뉴스 수집 · 중복 제거 · 요약 · 발송 자동화 | ![구현](https://img.shields.io/badge/%EA%B5%AC%ED%98%84-64748B?style=flat-square) |

### AI · 데이터 응용

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [온열질환자 수 예측](./ai-apps/heatwave-risk-ml) | 기상 자료로 전국 일일 온열질환자 수를 예측하는 ML 대시보드 | [![배포 중](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A4%91-16A34A?style=flat-square)](https://web-wine-one-11.vercel.app/) |
| [J·E TRACE](./ai-apps/je-trace) | AI 대화와 수정 과정을 남기는 교육 기록 플랫폼 | ![로컬 실행](https://img.shields.io/badge/%EB%A1%9C%EC%BB%AC%20%EC%8B%A4%ED%96%89-64748B?style=flat-square) |
| [GestureOS](./ai-apps/gesture-os) | 손 제스처로 Windows 입력 · PPT · 그리기를 제어하는 시스템 | ![로컬 실행](https://img.shields.io/badge/%EB%A1%9C%EC%BB%AC%20%EC%8B%A4%ED%96%89-64748B?style=flat-square) |

### 서비스 · 제품

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [HyukForge](./services/hyukforge) | 직접 만든 제품 · 릴리스 · 개발 기록을 운영하는 1인 소프트웨어 스튜디오 | [![배포 중](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A4%91-16A34A?style=flat-square)](https://hyukforge.vercel.app) |
| [출퇴근 생존일지](./services/commute-battle) | 근무시간 산정, 승인 라인, 월 마감을 갖춘 근태 관리 시스템 | [![배포 중](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A4%91-16A34A?style=flat-square)](https://commute-battle.vercel.app) |
| [LastCall](./services/lastcall) | 주변 응급실 · AED를 찾는 모바일 앱 (AWS EC2 운영 후 중단) | [![릴리스](https://img.shields.io/badge/%EB%A6%B4%EB%A6%AC%EC%8A%A4-2563EB?style=flat-square)](https://github.com/snail5039-code/lastcall/releases/tag/v1.0.0-rc4) ![서버 중단](https://img.shields.io/badge/%EC%84%9C%EB%B2%84%20%EC%A4%91%EB%8B%A8-94A3B8?style=flat-square) |
| [커리마](./services/curima) | 가계부 · 할 일 · 일정 · PC 작업을 자연어로 처리하는 개인비서 CLI | [![릴리스](https://img.shields.io/badge/%EB%A6%B4%EB%A6%AC%EC%8A%A4-2563EB?style=flat-square)](https://github.com/snail5039-code/personal-financial-management/releases/tag/v1.1.0-installer) |
| [WorkLog](./services/worklog) | 업무 기록을 보고서 · 인수인계 · 팀 협업으로 연결하는 서비스 | ![배포 전](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A0%84-94A3B8?style=flat-square) |
| [나만의 작은 맛집](./services/my-little-restaurant) | 맛집 저장 · 리뷰 · 소셜 로그인 웹 서비스 | [![배포 중](https://img.shields.io/badge/%EB%B0%B0%ED%8F%AC%20%EC%A4%91-16A34A?style=flat-square)](https://my-little-restaurant.vercel.app) |

학습 기록 : [AI Agent 학습 저장소](https://github.com/snail5039-code/aim-ai-agent-my) · [TIL](https://github.com/snail5039-code/TIL)

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| **AI · Agent** | ![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=flat-square&logo=langgraph&logoColor=white) ![LangChain](https://img.shields.io/badge/LangChain-1C3C3C?style=flat-square&logo=langchain&logoColor=white) ![LangSmith](https://img.shields.io/badge/LangSmith-1C3C3C?style=flat-square&logo=langchain&logoColor=white) ![Gemini](https://img.shields.io/badge/Gemini-8E75B2?style=flat-square&logo=googlegemini&logoColor=white) ![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white) ![MCP](https://img.shields.io/badge/MCP-111111?style=flat-square&logo=anthropic&logoColor=white) ![scikit-learn](https://img.shields.io/badge/scikit--learn-F7931E?style=flat-square&logo=scikitlearn&logoColor=white) |
| **Backend** | ![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white) ![Java](https://img.shields.io/badge/Java-007396?style=flat-square&logo=openjdk&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring%20Boot-6DB33F?style=flat-square&logo=springboot&logoColor=white) ![MyBatis](https://img.shields.io/badge/MyBatis-B22222?style=flat-square) |
| **Frontend · Mobile** | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![React Native](https://img.shields.io/badge/React%20Native-0EA5E9?style=flat-square&logo=react&logoColor=white) ![Flutter](https://img.shields.io/badge/Flutter-02569B?style=flat-square&logo=flutter&logoColor=white) |
| **Data · Infra** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![pgvector](https://img.shields.io/badge/pgvector-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=flat-square&logo=mysql&logoColor=white) ![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![AWS EC2](https://img.shields.io/badge/AWS%20EC2-FF9900?style=flat-square&logo=amazonec2&logoColor=white) ![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white) |
| **Test · Automation** | ![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white) ![JUnit](https://img.shields.io/badge/JUnit-25A162?style=flat-square&logo=junit5&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white) ![n8n](https://img.shields.io/badge/n8n-EA4B71?style=flat-square&logo=n8n&logoColor=white) |

## 폴더 구조

```text
portfolio/
├── ai-agents/                      # AI 에이전트
│   ├── virtual-bank-agent/         #   가상 금융 업무 에이전트 (LangGraph)
│   ├── n8n-voc-analysis/           #   고객 VOC 분석 (n8n)
│   └── n8n-finance-news-briefing/  #   금융 뉴스 브리핑 (n8n)
├── ai-apps/                        # AI · 데이터 응용
│   ├── heatwave-risk-ml/           #   온열질환자 수 예측
│   ├── je-trace/                   #   J·E TRACE
│   └── gesture-os/                 #   GestureOS
└── services/                       # 서비스 · 제품
    ├── hyukforge/                  #   HyukForge
    ├── commute-battle/             #   출퇴근 생존일지
    ├── lastcall/                   #   LastCall
    ├── curima/                     #   커리마
    ├── worklog/                    #   WorkLog
    └── my-little-restaurant/       #   나만의 작은 맛집
```

각 폴더는 별도 저장소의 검증된 시점을 옮긴 스냅샷이며, README에 기능 · 실행 방법 · 기술적 결정 · 한계를 적었습니다. 비밀키와 환경 변수는 포함하지 않습니다.<br>
개발 중인 프로젝트는 계속 바뀌기 때문에 원본 저장소로 바로 연결합니다. 커밋 규칙은 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)에 있습니다.

---

<div align="center">

[GitHub](https://github.com/snail5039-code) · [Email](mailto:snail5039@gmail.com) · [HyukForge](https://hyukforge.vercel.app)

</div>
