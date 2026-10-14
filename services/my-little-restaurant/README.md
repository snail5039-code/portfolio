# 나만의 작은 맛집

혼밥 또는 친구들과 먹기 좋은 식당을 저장·추천하고, 다녀온 곳은 체크하며 별점/메모를 남기는 개인 맛집 기록 서비스입니다. "맛집 도장깨기" 컨셉의 소셜 로그인 기반 웹 앱입니다.

> 배포 주소: [https://my-little-restaurant.vercel.app](https://my-little-restaurant.vercel.app)

## 주요 기능

- 카카오/구글 소셜 로그인 (Supabase Auth)
- 카드형 리스트 / 카카오맵 지도 토글로 맛집 탐색, 검색·카테고리 필터
- 맛집 등록, 방문 여부·즐겨찾기 토글, 리뷰·댓글, 메뉴 관리
- "오늘 뭐 먹지?" 랜덤 추천, 공공데이터 기반 모범음식점 인증 배지
- 마이페이지에서 방문 통계·즐겨찾기 요약, 공지사항 게시판

## 기술 스택

Next.js (App Router), Supabase (Postgres + Auth), 카카오맵 API, TypeScript, Tailwind CSS

## 실행 방법

```bash
npm install
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인할 수 있습니다. `.env.local`에 Supabase/카카오맵 키 등 환경변수 설정이 필요합니다.

## 문서

- [기획문서](./my-little-restaurant.md)
- [진행 요약](./요약.md)
- [회고](./회고.md)
