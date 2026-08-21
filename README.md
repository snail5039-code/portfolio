<div align="center">

# 박의혁 · Backend & AI Agent Developer

**서비스의 아이디어부터 구현, 자동화, 배포까지 연결합니다.**<br>
사용자에게 실제로 닿는 웹·모바일 서비스와 AI Agent 워크플로우를 만들고 있습니다.

[![GitHub](https://img.shields.io/badge/GitHub-snail5039--code-181717?style=flat-square&logo=github)](https://github.com/snail5039-code)
[![Email](https://img.shields.io/badge/Email-snail5039%40gmail.com-EA4335?style=flat-square&logo=gmail&logoColor=white)](mailto:snail5039@gmail.com)

</div>

---

## Featured Projects

### 🔨 [HyukForge](./hyukforge)

직접 만든 제품을 한곳에서 배포하는 1인 소프트웨어 스튜디오 사이트입니다. 제품·릴리스·공지·개발 기록을 관리자 페이지에서 등록하면 재배포 없이 사이트에 반영되고, 설치 파일은 GitHub Releases에서 로그인한 사용자에게 제공됩니다.

- **Live**: [hyukforge.vercel.app](https://hyukforge.vercel.app)
- **Tech**: Next.js 16 · React 19 · TypeScript · Supabase(Postgres·Auth·Storage) · next-intl · Tailwind CSS 4
- **Highlights**: 제품·릴리스·공지·개발 기록 관리자 CMS, 로그인 기반 다운로드 기록, GitHub Releases 파일 배포, 10개 언어 다국어(영어 폴백), 번역 키·RLS 검증 스크립트

### 🚇 [출퇴근 생존일지](./commute-battle)

출퇴근 기록을 회사 기준(소정근로·휴게·연장·야간·휴일근로)으로 계산하고, 정정·휴가·재택을 부서장이 승인하며, 월 마감으로 급여 지급 근거를 확정하는 근태 관리 시스템입니다. 워크스페이스 채팅과 AI 경로 안내도 함께 제공합니다.

- **Live**: [commute-battle.vercel.app](https://commute-battle.vercel.app)
- **Tech**: Next.js 16 · React 19 · TypeScript · Supabase(PostgreSQL 함수·RLS) · Gemini · Tailwind CSS 4 · Electron
- **Highlights**: 주 52시간 판정과 근무시간 집계, 정정 승인과 감사 로그, 휴가·연차·재택 승인, 공휴일 자동 갱신, 지오펜스 출근 인증, 월 마감 스냅샷, SQL 회귀 테스트 216개

### 🚑 [LastCall](./lastcall)

현재 위치와 진료 조건을 바탕으로 주변 응급실을 탐색하고 응급 행동 요령을 제공하는 모바일 서비스입니다.

- **Release**: [Android v1.0.0-rc4](https://github.com/snail5039-code/lastcall/releases/tag/v1.0.0-rc4)
- **Tech**: React Native · Expo SDK 54 · Spring Boot · MySQL · 공공데이터 API
- **Highlights**: 위치 기반 응급실 검색, 지도·필터, 즐겨찾기, 커뮤니티와 관리자 기능

### 🍽️ [나만의 작은 맛집](./my-little-restaurant)

맛집 저장과 리뷰, 소셜 로그인을 중심으로 개인 취향 기반 맛집 기록을 관리하는 웹 서비스입니다.

- **Live**: [my-little-restaurant.vercel.app](https://my-little-restaurant.vercel.app)
- **Tech**: Next.js 16 · React 19 · TypeScript · Supabase · Gemini · Tailwind CSS 4
- **Highlights**: 맛집 아카이빙, 리뷰 기록, 소셜 로그인, 개인화된 맛집 관리 흐름

### ✋ [GestureOSManager](./GestureOS)

카메라로 손 제스처를 인식해 Windows 마우스·키보드·PPT·그리기를 제어하는 접근성(대체 입력) 시스템입니다. 데스크톱 매니저에서 제스처 매핑을 바꾸고, 인식이 잘 안 되는 제스처는 본인 손으로 학습시킬 수 있습니다.

- **Tech**: Python 3.12 · MediaPipe · OpenCV · Spring Boot 3 · React 19 · Electron · PostgreSQL
- **Highlights**: 모드별 제스처 매핑(마우스·키보드·PPT·드로잉), 손 랜드마크 63차원 개인별 MLP 학습, WinAPI `SendInput` 입력 주입, 데스크톱·웹 매니저 분리(8080·8082), 로컬 세션 토큰 인증
- **상태**: 로컬 개발까지 동작(미배포). 2026-08에 인증·권한 경로 점검과 마우스 모드 크래시 수정 — [내역](./GestureOS/PROJECT_STATUS.md)

---

## Projects

| 분야 | 프로젝트 | 한 줄 소개 | 주요 기술 | 상태 |
| :--: | --- | --- | --- | :--: |
| 🔨 | [HyukForge](./hyukforge) | 직접 만든 제품을 배포하는 1인 스튜디오 사이트 | Next.js 16, Supabase, next-intl | **배포** |
| 📱 | [LastCall](./lastcall) | 위치 기반 응급실 탐색 모바일 서비스 | Expo, Spring Boot, MySQL | 미출시 (배포 완료) |
| 🌐 | [출퇴근 생존일지](./commute-battle) | 근무시간 산정·승인 라인·월 마감을 갖춘 근태 관리 시스템 | Next.js 16, Supabase, Gemini, Electron | **배포** |
| 📝 | [WorkLog](./WorkLog_project) | 업무일지를 요약해 DOCX 양식으로 뽑는 업무 기록 시스템 | Spring Boot 3, MyBatis, React 19, MySQL | 구현 |
| 🖐️ | [GestureOSManager](./GestureOS) | 손 제스처 인식 기반 Windows 입력·OS 제어 시스템 | MediaPipe, OpenCV, Spring Boot, Electron | 구현 |
| 🎓 | [J-E-Trace](./J-E-Trace) | AI 대화 로그로 학습 과정을 추적하는 교육 플랫폼 | React Router 7, Spring Boot, MySQL | 구현 |
| 🍽️ | [나만의 작은 맛집](./my-little-restaurant) | 맛집 저장·리뷰와 소셜 로그인을 제공하는 웹 앱 | Next.js 16, React 19, Supabase, Gemini | **배포** |
| 🤖 | [고객 VOC 분석 Agent](./고객_VOC_분석_Agent) | 고객 문의 분류, 감정 분석과 긴급 알림 자동화 | n8n, Gemini, Google Sheets | 구현 |
| 📰 | [금융 뉴스 브리핑 Agent](./금융_뉴스_브리핑_Agent) | 금융 뉴스 수집·중복 제거·요약·발송 자동화 | n8n, RSS, Gemini, Discord | 구현 |
| 🔮 | [과제 미루기 사주 / AI 사주보기](./사주챗봇) | 재미로 보는 사주와 과제 운세 웹 앱 | Flask, Python, Gemini | 구현 |

## Workflow Ideas & Documents

| 프로젝트 | 내용 | 단계 |
| --- | --- | :--: |
| [n8n 날씨운세봇](./n8n_날씨운세봇) | 매일 아침 날씨와 개인화 운세를 Discord로 발송 | 기획 |
| [n8n API 가이드봇](./n8n_API가이드봇) | Public API를 찾아 추천하고 실행 결과까지 전달 | 기획 |
| [캘린더 회고봇](./캘린더회고봇) | Google Calendar 기반 주간 회고 리포트 생성 | 기획 |
| [출퇴근 생존일지 초기 기획](./출퇴근전쟁봇) | 웹 서비스로 발전하기 전의 Telegram Bot 기획 | 발전 완료 |
| [최종 프로젝트 아이디어](./최종프로젝트_아이디어) | 미니 프로젝트 경험을 종합한 서비스 아이디어 노트 | 아이디어 |

---

## Tech Stack

| 영역 | 기술 |
| --- | --- |
| **Backend** | Java, Spring Boot, Python, Flask, MyBatis |
| **Frontend** | React 19, React Router 7, Next.js 16, TypeScript, Tailwind CSS 4, next-intl |
| **Mobile / Desktop** | React Native, Expo, Electron |
| **AI / Vision** | Google Gemini, MediaPipe, OpenCV |
| **Data / Infra** | MySQL, PostgreSQL(함수·RLS), Supabase, Firebase, Vercel |
| **Automation** | n8n, Google Sheets, Discord Webhook, Telegram Bot API |

## Repository Guide

각 프로젝트 폴더에는 기능, 실행 방법, 기술적 의사결정과 트러블슈팅을 정리한 별도 README가 있습니다.<br>
커밋 규칙은 [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md)에서 확인할 수 있습니다.

> 일부 프로젝트는 별도 저장소에서 개발한 결과물을 포트폴리오용으로 정리한 스냅샷이며, API 키와 환경 변수는 포함하지 않습니다.

---

<div align="center">

### Contact

[GitHub](https://github.com/snail5039-code) · [Email](mailto:snail5039@gmail.com)

</div>
