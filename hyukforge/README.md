# HyukForge

> 혼자 만들고 혼자 고칩니다.

박의혁(snail5039-code) 1인 소프트웨어 스튜디오의 제품 배포 사이트입니다.
사무용 도구, 작은 게임, 유틸리티, 실험적인 웹앱을 한곳에 모아 배포합니다.

**배포**: https://hyukforge.vercel.app · **1단계 목표**: 무료 배포 스토어.
결제·사업자등록은 다음 단계로 미룹니다.

---

## 지금 올라간 것

| 항목 | 상태 |
| --- | --- |
| 제품 | 2개 — 출퇴근 생존일지 (Windows, v0.1.0) · 살려줌 (Android 테스트 빌드, v1.0.0-rc4) |
| 공지 | 3건 |
| 개발 기록 | 10건 |
| 화면 | 홈 · 제품 · 다운로드 · 공지 · 게시판 · 개발 기록 · 검색 · 소개 · 약관 |
| 언어 | 10개 (화면 문구 전부, 제품 소개는 ko·en 이고 나머지는 en 폴백) |

자세한 상태와 남은 일은 [docs/HANDOFF.md](./docs/HANDOFF.md) 에 있습니다.

## 문서

| 문서 | 내용 |
| --- | --- |
| [docs/PRD.md](./docs/PRD.md) | 무엇을 왜 만드는가 — 범위, 기능 명세, 단계별 계획 |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 기술 스택, DB 스키마, 다운로드 흐름, 다국어 전략 |
| [docs/DESIGN.md](./docs/DESIGN.md) | 디자인 시스템 — 워크벤치 톤, 토큰, 컴포넌트 규칙 |
| [COMMIT_CONVENTION.md](./COMMIT_CONVENTION.md) | 커밋 메시지 규칙 (Conventional Commits) |
| [docs/HANDOFF.md](./docs/HANDOFF.md) | **이어서 작업하기** — 현재 상태, 남은 일, 반복해서 걸린 함정 |

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프레임워크 | Next.js 16 (App Router) · React 19 · TypeScript |
| 스타일 | Tailwind CSS 4 |
| 데이터·인증 | Supabase (Postgres · Auth · Storage) |
| 파일 배포 | GitHub Releases |
| 다국어 | next-intl (10개 언어) |
| 배포 | Vercel |

## 확정된 결정

- **결제 없음.** 1단계는 전부 무료 배포. 스키마만 유료 전환에 대비해 열어둔다.
- **다운로드는 로그인 필수.** 누가 무엇을 받았는지 기록하고 업데이트 알림을 보내기 위함.
- **설치파일은 GitHub Releases에 호스팅.** 용량·대역폭 무료, 파일당 2GB.
  스크린샷만 Supabase Storage 에 둔다.
- **제품·공지·개발 기록은 관리자 페이지에서 쓴다.** 내용을 더할 때 재배포가 필요 없도록.
- **10개 언어 지원.** 한국어 기본, 미번역 언어는 영어로 폴백.
  사용자가 쓴 글(게시판)은 번역하지 않는다.
- **알림은 사이트 안에서만.** 메일은 보내지 않기로 정했다 (2026-08-19).
- **디자인은 워크벤치 톤.** 검정 바탕 · 앰버 단일 강조색 · 모노스페이스 라벨. 그라데이션과 글로우 금지.
- **숫자는 진짜만.** 0이면 0을 보여준다. 예시 데이터는 `/preview` 화면에만 쓰고 DB 에 넣지 않는다.

## 시작하기

```bash
npm install
cp .env.example .env.local   # Supabase 키 입력
npm run dev
```

`/ko/preview` 에 예시 데이터로 만든 화면 묶음이 있습니다 (개발 환경에서만 열립니다).

## 검증

고칠 때마다 이 네 개를 돌립니다. `build` 는 번역 검사를 포함합니다.

```bash
npx tsc --noEmit              # 타입
npm run i18n:check            # 번역 키 10개 언어 일치
node scripts/db-check.mjs     # 원격 스키마와 접근 제어
npm run build                 # 정적/동적 분포까지 확인
```

RLS 를 건드렸으면 `db-check` 를 반드시 돌립니다. 권한 검사는
`npm run test:role-guard` 로 자가 승격이 막히는지 실제로 시도해 봅니다.

## 관리

| 하는 일 | 방법 |
| --- | --- |
| 제품·릴리스·공지·개발 기록 등록 | `/ko/admin` (관리자 로그인) |
| 스크린샷 올리기 | 제품 수정 화면에서 직접 업로드 (5MB, PNG·JPEG·WebP·AVIF) |
| 마이그레이션 적용 | `npx supabase db push` |
| 관리자 지정 | `npm run make-admin` |
