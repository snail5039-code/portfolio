# 나만의 작은 맛집 — 기획문서

## 1. 서비스 개요

- **서비스명**: 나만의 작은 맛집
- **한 줄 설명**: 혼밥 또는 친구들과 먹기 좋은 식당들을 저장 및 추천 해주면서 체크할 수 있는 앱
- **컨셉**: 맛집 도장깨기 — 가고 싶은 식당을 저장해두고, 다녀온 곳은 체크하면서 별점/메모를 남기는 개인 맛집 기록 서비스

## 2. 기술 스택

| 구분 | 선택 | 비고 |
| --- | --- | --- |
| 프레임워크 | Next.js (App Router) | 프론트+API Route를 한 프로젝트에서 처리 |
| DB / 인증 / (추후) 파일 저장 | Supabase | Postgres DB + Auth + Storage 제공 |
| 지도 | 카카오맵 API | 국내 주소/좌표 정확도가 높음 |
| 로그인 | 소셜 로그인 (카카오, 구글) | Supabase Auth의 OAuth Provider 기능 사용 |

> Supabase Auth를 쓰면 이메일/비밀번호는 `auth.users`(Supabase 내부 테이블)에서 자동 관리되므로, 서비스에서 직접 만드는 `profiles` 테이블에는 비밀번호를 저장하지 않습니다.

## 3. 테이블 설계 (ERD)

### profiles (유저 프로필)

> Supabase Auth의 `auth.users`와 1:1로 연결되는 확장 테이블. `id`는 `auth.users.id`(uuid)를 그대로 사용.

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | auth.users.id 참조 (uuid, PK) |
| 2 | nickname | 닉네임 |
| 3 | phone | 전화번호 (선택) |
| 4 | provider | 로그인 경로 (kakao/google) |
| 5 | role | 일반/관리자 |
| 6 | created_at | 가입일 (자동) |
| 7 | updated_at | 수정일 |

### categories (카테고리)

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | (자동) |
| 2 | name | 카테고리명 (한식/중식/일식/양식/카페 등) |
| 3 | created_at | (자동) |

### restaurants (식당)

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | (자동) |
| 2 | name | 식당 이름 |
| 3 | category_id | categories 테이블 참조 |
| 4 | address | 주소 |
| 5 | latitude | 위도 (카카오맵 좌표) |
| 6 | longitude | 경도 (카카오맵 좌표) |
| 7 | visited | 다녀왔는지 (true/false) |
| 8 | alone_ok | 혼밥 난이도 (1~5) |
| 9 | rating | 별점 (1~5, 안 갔으면 비움) |
| 10 | memo | 한 줄 메모 |
| 11 | user_id | profiles 참조 (누가 등록했는지) |
| 12 | created_at | (자동) |

### reviews (리뷰)

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | (자동) |
| 2 | user_id | profiles 참조 |
| 3 | restaurant_id | restaurants 참조 |
| 4 | rating | 별점 |
| 5 | content | 내용 |
| 6 | created_at | 작성일 |
| 7 | updated_at | 수정일 |

### favorites (좋아요/즐겨찾기)

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | (자동) |
| 2 | user_id | profiles 참조 |
| 3 | restaurant_id | restaurants 참조 |
| 4 | created_at | 좋아요 클릭일 |

### menu (메뉴)

| # | 컬럼명 | 설명 |
| --- | --- | --- |
| 1 | id | (자동) |
| 2 | restaurant_id | restaurants 참조 |
| 3 | name | 메뉴 이름 |
| 4 | price | 메뉴 가격 |
| 5 | description | 메뉴 설명 |
| 6 | is_representative | 대표 메뉴 여부 (true/false) |

### 테이블 관계

- `auth.users` 1 : 1 `profiles`
- `profiles` 1 : N `restaurants` (한 유저가 여러 식당을 등록)
- `profiles` 1 : N `reviews`
- `profiles` 1 : N `favorites`
- `categories` 1 : N `restaurants`
- `restaurants` 1 : N `reviews`
- `restaurants` 1 : N `favorites`
- `restaurants` 1 : N `menu`

## 4. 화면 구성

### 4-1. 메인 화면 (`/`)

- **사이드바**: 좌측 고정 네비게이션
- **중앙**: 간단한 웹사이트 설명 (사진 포함)
- **우측**: 시작하기 및 사용 방법 안내
- **우상단**: 회원가입 버튼 → 카카오/구글 소셜 로그인으로 연결

### 4-2. 맛집 카드 리스트 / 지도 화면 (`/restaurants`)

- 상단에 **"카드 형식으로만 보기 / 지도로만 보기"** 토글 버튼
- **카드 뷰**: 맛집 카드(별점, 리뷰수, 상세보기)를 그리드로 나열, 카드에 메모장 기능 포함
- **지도 뷰**: 카카오맵 위에 `latitude`/`longitude` 기준으로 핀 표시, 핀 클릭 시 카드 정보 노출

### 4-3. 맛집 상세 화면 (`/restaurants/[id]`)

- 가게 사진
- 카테고리 / 가게 설명
- 평점
- 방문 여부 / 좋아요 수 / 혼밥 난이도
- 리뷰 수 / 리뷰 내용
- 메뉴 목록

### 4-4. 마이페이지 (`/mypage`)

- **좌측**: 최애 맛집 및 방문한 수를 간단하게 요약 표시 (카드형 요약 박스 3개)
- **우측**: 개인정보 수정 (토글로 열었다 닫을 수 있게), 닉네임/전화번호 등 입력 필드 (이메일/비밀번호는 소셜 로그인 계정 정보이므로 수정 불가)

## 5. 인증 흐름

1. 사용자가 "회원가입/로그인" 클릭 → 카카오 또는 구글 OAuth 화면으로 이동
2. Supabase Auth가 로그인 처리 후 `auth.users`에 계정 생성/조회
3. 최초 로그인 시 `profiles` 테이블에 해당 `user_id`로 프로필 row 생성 (닉네임 기본값은 소셜 계정 이름)
4. 이후 서비스 내 모든 데이터(restaurants, reviews, favorites)는 `profiles.id` 기준으로 연결

## 6. 미구현 (차후 구현 예정)

- 사진 업로드 (Supabase Storage 연동 예정)
- 친구 팔로우
- 댓글

## 7. 협업 가이드라인 (Claude 작업 시 참고)

- **배경**: 정보처리산업기사 자격 보유(국비지원 과정 이수). 직업군인으로 9년 근무 후 개발로 전향. 자바 기본기가 있고 현재 파이썬 학습 중. 개발 경험은 어느 정도 있는 편.
- **사용자 경험 수준**: 주니어 — 기본기는 있지만 Next.js/Supabase 등 이 프로젝트에서 쓰는 특정 기술은 낯설 수 있음. 새로운 개념이나 API를 도입할 때는 짧게라도 왜 필요한지 짚어줄 것.
- **배포 관련**: 배포 경험 자체가 적어서 불안해하는 편(실력 문제라기보다 경험 부족). Vercel 배포/환경변수 설정 등은 진행 전후로 어떤 단계인지, 왜 필요한지 짧게 짚어주고 실패 시 원인을 명확히 짚어줄 것.
- **협업 방식**: 설명보다 실행 우선. 배포, 계정 설정 변경처럼 승인이 필요한 작업이 아니면 먼저 진행하고 결과를 보고한다.
- **설명 스타일**: 적당히 자세하게 — 핵심 변경 사항과 이유 정도만 전달. 불필요한 배경 설명이나 장황한 부연은 생략.

## 8. 진행 상황 (2026-08-03 기준)

**완료**
- 라우트 구조: `/`(랜딩), `/restaurants`(카드·지도 토글), `/restaurants/[id]`(상세), `/mypage`
- 공통 사이드바 레이아웃, 맛집 카드 컴포넌트
- Supabase 스키마: restaurants/categories/profiles/reviews/favorites/menu + RLS (프로젝트 ID `fttlyjldmxzybkzkjfng`, 서울 리전)
- 카카오맵 연동 (`src/components/KakaoMap.tsx`) — Kakao Developers 앱 "나만의 작은 맛집"(ID 1532223)의 JS 키 사용, 로컬/Vercel 도메인 등록 완료
- 카카오 + 구글 소셜 로그인 (Supabase Auth, `@supabase/ssr`) — 로그인 시 `handle_new_user` 트리거로 profiles row 자동 생성, `/mypage`는 로그인 필요
  - Kakao: Kakao Developers 앱의 카카오 로그인 활성화, 동의항목(닉네임/프로필사진) 필수 설정, Redirect URI 등록 완료
  - Google: GCP 프로젝트 "my-little-restaurant" 생성, OAuth 동의화면 설정 후 **프로덕션으로 게시 완료** (테스트 사용자 제한 없음, 민감 스코프 미사용이라 검증 불필요)
- Vercel 환경변수에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 등록 완료 (Production, Preview) — 다음 배포부터 지도 표시됨
- UI 아이콘 정리: 이모지 대신 `lucide-react` 라이브러리 아이콘으로 교체 (랜딩/사이드바/카드/상세/마이페이지 전반)
- 쓰기(write) 기능 1차 구현
  - 맛집 등록: `/restaurants`의 "맛집 등록" 모달 (`RegisterRestaurantModal.tsx`) — 이름/카테고리/주소/혼밥난이도/메모 입력, 주소는 카카오 Geocoder로 좌표 자동 변환 후 저장
  - 메모 수정: 맛집 카드에서 본인이 등록한 가게만 인라인으로 메모 수정 가능 (RLS로 소유자만 UPDATE 허용)
  - 마이페이지: 실제 로그인 사용자의 방문 수(등록한 가게 중 `visited=true`)/즐겨찾기 수/즐겨찾기 목록을 Supabase에서 조회해 표시, 닉네임·전화번호 수정 폼 실제 반영 (`src/app/restaurants/actions.ts`, `src/app/mypage/actions.ts`의 Server Action)
- 카카오맵 도메인 등록 완료 (카카오 디벨로퍼스 Web 플랫폼에 `my-little-restaurant.vercel.app` 등록)
- 카카오 로그인 완전히 해결 (두 가지 문제가 겹쳐 있었음)
  1. **KOE205**: Supabase가 카카오 로그인 시 `account_email` 스코프를 하드코딩해서 요청하는데, 일반(비-비즈) 앱은 이 동의항목 자체가 없어서 발생. → 카카오 디벨로퍼스에서 **개인 개발자 비즈 앱**으로 전환(앱 아이콘 등록 → 비즈니스 정보 등록 → 본인인증 + 카카오비즈니스 통합 서비스 약관 동의) 후, 동의항목에서 `account_email`을 선택 동의로 설정해서 해결
  2. **invalid_client (Bad client credentials)**: 비즈 앱 전환 과정에서 카카오 Client Secret이 어긋남 → 카카오 디벨로퍼스 앱설정>플랫폼 키>REST API 키 안의 "클라이언트 시크릿 > 카카오 로그인" 코드를 Supabase Kakao Provider의 Client Secret Code에 다시 붙여넣어서 해결
  - 참고: Supabase Auth 로그(`get_logs` service=auth)로 실제 에러 메시지를 확인한 게 결정적이었음 — 화면에 뜨는 "로그인에 실패했어요"만 봐서는 원인 구분 불가
- 구글 로그인은 별도 코드 수정 없이 정상 동작 확인 (Supabase Users 테이블에 계정 생성됨)
- UI 전면 리디자인 두 차례
  - 1차: 타베로그 참고, 그라데이션 카드 → 배지형 평점, 모바일 사이드바 드로어, 로그인 게이트를 모달로 교체
  - 2차 (1차가 "AI가 만든 티가 난다"는 피드백 이후 전면 재작업): CSS 변수 기반 디자인 토큰 시스템 도입, 카카오/구글 로그인 버튼을 실제 브랜드 컬러 SVG로 교체(`BrandIcons.tsx`), 별 5개가 소수점만큼 채워지는 `Rating.tsx` 컴포넌트 신규 제작, 맛집 리스트에 검색+카테고리 필터 추가, 전 페이지 재작성
  - OAuth 콜백 안전장치: Supabase Redirect URLs 설정이 어긋나도 로그인이 끝나도록 `/auth/callback` 이외 경로로 떨어진 `code`도 처리하게 미들웨어 보강 (`src/lib/supabase/proxy.ts`)
- 쓰기 기능 2차 확장
  - 즐겨찾기(하트) 토글: 카드/상세 페이지에서 클릭 한 번으로 on/off (`FavoriteButton.tsx`, `toggleFavorite` action)
  - 방문 여부 토글: 본인이 등록한 가게만 상세/카드에서 체크 가능 (`VisitedToggle.tsx`, `updateVisited` action)
  - 리뷰 작성 폼 + 등록 시 `restaurants.rating`을 리뷰 평균으로 자동 갱신 (`ReviewForm.tsx`, `createReview` action)
  - 댓글 기능: `comments` 테이블 신규 (RLS: 공개 읽기, 본인만 작성/삭제) (`CommentSection.tsx`)
  - 메뉴 관리: 가게 등록자가 상세 페이지에서 직접 메뉴 추가/삭제 (`MenuSection.tsx`) — 카카오맵 API는 메뉴/사진 데이터를 제공하지 않고, 스크래핑은 저작권·이용약관 문제로 보류
  - 지도 마커 클릭 시 이름+메모 미리보기와 상세보기 링크가 뜨는 인포윈도우로 교체
  - 맛집 등록 모달에 주소 검색과 별개로 지도를 클릭해 좌표를 직접 찍는 `CoordPickerMap.tsx` 추가 (카카오맵 스크립트 로딩 로직은 `src/lib/kakao.ts`로 공통화)
  - 로그인 상태면 랜딩 페이지에 로그인 버튼 대신 "맛집 리스트로 이동" 버튼 표시
- 커뮤니티 게시판(`/board`) 신규: 공지사항(관리자만 작성, `profiles.role='admin'` RLS로 강제)/자유게시판/의견수렴, 목록·상세·글쓰기·삭제까지 `posts` 테이블 기반으로 구현
- "오늘 뭐 먹지?" 추천 모달(`RecommendModal.tsx`): 카테고리/안 가본 곳만/혼밥 편한 곳만 필터로 저장된 맛집 중 3~5곳 랜덤 추천
- **모범음식점 인증 배지**: 공공데이터포털(data.go.kr) "행정안전부_모범음식점정보 조회서비스"(데이터셋 15155052) 연동 완료.
  - API 스펙은 로그인 없이도 브라우저로 페이지의 Swagger UI(`window.ui.specSelectors.specJson()`)를 직접 읽어서 확인함 — Base URL `apis.data.go.kr/1741000/excellent_restaurant_info`, `GET /info`, 검색 파라미터는 `cond[BSNSSP_NM::LIKE]`(업소명 포함검색) 등. 메뉴·사진 필드는 없음(업소명/주소/전화번호/음식유형/지정일자만 제공) — 메뉴 매칭은 애초에 불가능.
  - `src/lib/modelRestaurant.ts`의 `checkModelRestaurant(name, address)`가 업소명으로 조회 후, 주소에서 자치구(구/군, 없으면 시) 단위를 뽑아 교차검증하고, 지정취소(`DSGN_RTRCN_YMD` 존재) 건은 제외
  - 맛집 상세 페이지(`src/app/restaurants/[id]/page.tsx`)에서 이름 옆에 `ModelRestaurantBadge` 표시, Next.js `fetch` 캐시로 하루 1회만 재조회 (DB 컬럼 캐싱은 아직 안 함)
  - Vercel 환경변수(Production, Preview)에 `DATA_GO_KR_SERVICE_KEY` 등록 완료 — 다음 배포부터 배지 표시됨
- **"우리 동네 모범업소 찾기"**: 지도 화면에 구/군/시 이름으로 검색하면 그 지역의 공공데이터 모범음식점을 지도에 표시하는 기능 (`NearbyModelRestaurantSearch.tsx`, `src/lib/modelRestaurant.ts`의 `searchModelRestaurantsByRegion`).
  - **API 제약 발견**: 이 API의 `cond[FIELD::LIKE]` 검색어에 공백이 들어가면 결과가 무조건 0건이 됨(실제 호출로 확인, "서울특별시 강남구"는 0건인데 "강남구"만 넣으면 정상 매칵). 그래서 사용자가 여러 단어를 입력해도 첫 단어만 검색어로 사용하도록 처리함 — UI에도 "구/군/시 이름 한 단어로 검색" 안내 표시.
  - 공공데이터에는 좌표가 없어서, 검색 결과 주소를 카카오맵 Geocoder로 클라이언트에서 변환 후 지도에 초록색 마커로 표시 (내 저장 맛집의 빨간 기본 마커와 구분). 한 번에 최대 100곳(API 한 페이지 최대치)까지 가져오고, 전체 건수가 더 많으면 "총 N곳 중 M곳 표시" 안내. Geocoder 호출은 8개씩 동시 처리(`geocodeWithLimit`)해서 한꺼번에 몰아 호출할 때보다 실패율이 낮음(강남구 기준 100건 중 92곳 정상 표시 확인).
  - "중구/동구/서구/남구/북구"처럼 여러 도시에 같은 구 이름이 있는 경우 다른 도시 결과가 섞여 나올 수 있음 (지역명이 고유하지 않은 한계, 마커 클릭 시 주소로 구분 가능).
  - 검색(Enter/버튼) 시작하자마자 입력창 포커스를 풀어서 모바일 자판이 바로 내려가도록 처리.
  - **검색 없이 자동 표시**: 지도 화면 진입 시 내 현재 위치를 카카오 Geocoder의 역지오코딩(`coord2Address`)으로 구/군 이름으로 변환해서, 검색창을 건드리지 않아도 우리 동네 모범업소가 자동으로 지도에 뜬다. 위치 권한을 거부하면 자동 표시는 안 되고 수동 검색만 가능. 검색창은 그대로 남겨둬서 다른 지역을 찾아볼 때 쓸 수 있음.
- **카테고리 확장**: `categories` 테이블에 피자/치킨/족발/패스트푸드 추가 (기존 한식/중식/일식/양식/카페/분식) — "오늘 뭐 먹지?"와 맛집 리스트의 카테고리 필터는 등록된 맛집의 카테고리를 동적으로 읽어오므로 코드 수정 없이 자동으로 반영됨.
- **공지사항 3건 등록**: 서비스 소개, 모범음식점 배지 안내, 카테고리/지도 기능 안내. 공지 작성 권한이 필요해서 실제 계정(snail5039@gmail.com, `profiles.id=6cea6815-...`)을 `role='admin'`으로 변경함 — 앞으로 이 계정으로 로그인하면 사이트에서 직접 공지 작성 가능.
- **지도 중심 = 실제 내 위치**: 기본 지도 보기(모범업소 검색 결과가 없을 때)는 `navigator.geolocation`으로 실제 현재 위치를 받아와 그 위치로 지도를 이동하고 파란 점 마커로 표시. 위치 권한을 거부하거나 실패하면 기존 방식(내 맛집 마커 위치 → 서울시청)으로 자동 대체. "우리 동네 모범업소 찾기"로 검색한 결과가 있을 때는 검색한 지역을 계속 보여줘야 하므로 내 위치로 되돌아가지 않음.
