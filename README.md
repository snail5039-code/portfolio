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
| **[금융 AI 에이전트](https://github.com/snail5039-code/financial-ai-agent)** | 투자 제안·독립 검증·정책 검사·사용자 승인을 분리한 23개 화면의 운영 대시보드입니다. 모든 화면을 FastAPI와 연결하고 승인 상태를 SQLite에 저장하며, OpenDART 조회와 KIS 모의투자 연동 경계를 구현했습니다. | React, TypeScript, FastAPI, SQLite · **프로토타입** |
| **[출퇴근 생존일지](./commute-battle)** | 근무 기록부터 정정·휴가·재택 승인과 월 마감까지 연결한 근태 관리 시스템입니다. 임금 관련 계산을 PostgreSQL 함수에 두고 SQL 회귀 테스트 216개로 검증했습니다. | Next.js 16, Supabase, Gemini, Electron · **배포** |
| **[J·E TRACE](./J-E-Trace)** | 학생의 AI 대화와 수정 과정을 기록하고 교사가 피드백하는 교육 플랫폼입니다. 보안·권한 문제를 포함한 29단계 점검을 수행하고 백엔드 68개, E2E 45개 테스트를 구성했습니다. | React Router 7, Spring Boot 4, MySQL, OpenAI · **로컬 실행** |
| **[온열질환자 수 예측](./heatwave-risk-ml)** | 2022~2025년 기상·신고 자료로 전국 일일 환자 수를 예측합니다. 전체 연령과 65세 이상 모델을 분리하고 Streamlit과 Next.js 두 화면으로 배포했습니다. | Python, scikit-learn, Streamlit, Next.js · **배포** |

> 각 수치와 상태는 해당 저장소의 README, 테스트 기록, 배포 결과를 기준으로 작성했습니다.

## 프로젝트 모아보기

### 서비스 · 제품

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [HyukForge](./hyukforge) | 직접 만든 제품·릴리스·개발 기록을 운영하는 1인 소프트웨어 스튜디오 | [배포](https://hyukforge.vercel.app) |
| [출퇴근 생존일지](./commute-battle) | 근무시간 산정, 승인 라인, 월 마감을 갖춘 근태 관리 시스템 | [배포](https://commute-battle.vercel.app) |
| [나만의 작은 맛집](./my-little-restaurant) | 맛집 저장·리뷰·소셜 로그인 웹 서비스 | [배포](https://my-little-restaurant.vercel.app) |
| [LastCall](./lastcall) | 위치와 진료 조건을 바탕으로 주변 응급실을 찾는 모바일 앱 | [Android 릴리스](https://github.com/snail5039-code/lastcall/releases/tag/v1.0.0-rc4) |
| [WorkLog](./WorkLog_project) | 업무 기록을 보고서·인수인계·팀 협업으로 연결하는 서비스 | 배포 전 |
| [커리마](./커리마) | 가계부·할 일·일정·PC 작업을 자연어로 처리하는 개인비서 CLI | [Windows 릴리스](https://github.com/snail5039-code/personal-financial-management/releases/tag/v1.1.0-installer) |

### AI · 데이터 · 인터랙션

| 프로젝트 | 한 줄 소개 | 상태 |
| --- | --- | :--: |
| [금융 AI 에이전트](https://github.com/snail5039-code/financial-ai-agent) | 제안·검증·승인 경계를 중심으로 만든 금융 운영 대시보드 | 프로토타입 |
| [온열질환자 수 예측](./heatwave-risk-ml) | 전국 일일 온열질환자 수 예측과 분석 대시보드 | [Streamlit](https://heatwave-risk-ml-twwshgp6evhagezahawdeq.streamlit.app/) · [Web](https://web-wine-one-11.vercel.app/) |
| [GestureOSManager](./GestureOS) | 손 제스처로 Windows 입력·PPT·그리기를 제어하는 시스템 | 로컬 실행 |
| [J·E TRACE](./J-E-Trace) | AI 대화와 수정 과정을 남기는 교육 기록 플랫폼 | 로컬 실행 |
| [고객 VOC 분석 Agent](./고객_VOC_분석_Agent) | 문의 분류·감정 분석·긴급 알림 자동화 | 구현 |
| [금융 뉴스 브리핑 Agent](./금융_뉴스_브리핑_Agent) | 금융 뉴스 수집·중복 제거·요약·발송 자동화 | 구현 |

<details>
<summary><b>학습 기록과 초기 기획 보기</b></summary>

<br>

- [AI Agent 학습 저장소](https://github.com/snail5039-code/aim-ai-agent-my) · [TIL](https://github.com/snail5039-code/TIL)
- [n8n 날씨운세봇](./n8n_날씨운세봇) · [n8n API 가이드봇](./n8n_API가이드봇)
- [캘린더 회고봇](./캘린더회고봇) · [출퇴근 생존일지 초기 기획](./출퇴근전쟁봇)
- [AI 사주보기](./사주챗봇) · [최종 프로젝트 아이디어](./최종프로젝트_아이디어)

</details>

## 주로 사용하는 기술

| 영역 | 기술 |
| --- | --- |
| Backend | Java 17, Spring Boot, Python, FastAPI, Flask, MyBatis |
| Frontend | React 19, Next.js 16, TypeScript, React Router, Tailwind CSS |
| Data · AI | OpenAI, Gemini, LangChain, scikit-learn, MediaPipe, OpenCV |
| Database · Infra | PostgreSQL, MySQL, SQLite, Supabase, Firebase, Vercel |
| Test · Automation | JUnit, Pytest, Playwright, n8n, GitHub Actions |

## 저장소 안내

각 프로젝트 폴더의 README에는 기능, 실행 방법, 기술적 결정, 현재 한계를 따로 기록했습니다.<br>
일부 폴더는 별도 저장소의 검증된 시점을 옮긴 포트폴리오 스냅샷이며, 비밀키와 환경 변수는 포함하지 않습니다.

커밋 규칙은 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)에서 확인할 수 있습니다.

---

<div align="center">

[GitHub](https://github.com/snail5039-code) · [Email](mailto:snail5039@gmail.com)

</div>
