# HyukForge — 아키텍처

작성일: 2026-08-17

---

## 1. 구성

```
브라우저
   │
   ├─ Vercel (Next.js 15 App Router)
   │     ├─ 공개 화면            서버 컴포넌트로 Supabase 직접 조회
   │     ├─ /admin               role='admin' 확인 후 진입
   │     └─ /api/download/[id]   세션 확인 → 기록 → 302 리다이렉트
   │
   ├─ Supabase
   │     ├─ Postgres   제품·릴리스·번역·다운로드 기록
   │     ├─ Auth       Google OAuth + 이메일 매직 링크
   │     └─ Storage    스크린샷·아이콘 (그리고 나중에 유료 제품 파일)
   │
   └─ GitHub Releases  설치파일 실물 (exe / zip)
```

**왜 파일을 GitHub에 두는가**
Supabase 무료 티어는 저장 1GB · 대역폭 5GB/월이다. 300MB짜리 게임 하나면 한 달에 16번 받고 끝난다.
GitHub Releases는 파일당 2GB, 대역폭 제한이 사실상 없고 무료다.
대신 주소가 공개라 접근 제한이 불가능하다 — 전부 무료인 지금은 상관없고, 유료 제품이 생기면 그것만 Storage로 옮긴다.

## 2. 폴더 구조

```
hyukforge/
├─ app/
│  ├─ [locale]/
│  │  ├─ page.tsx                    홈
│  │  ├─ products/page.tsx           제품 목록
│  │  ├─ products/[slug]/page.tsx    제품 상세
│  │  ├─ downloads/page.tsx          다운로드 표
│  │  ├─ changelog/page.tsx          개발 기록
│  │  ├─ about/page.tsx              소개
│  │  ├─ me/page.tsx                 내 서랍
│  │  ├─ login/page.tsx
│  │  └─ legal/[doc]/page.tsx        약관·개인정보
│  ├─ admin/
│  │  ├─ layout.tsx                  role 검사 (여기 한 곳에서만)
│  │  ├─ products/                   목록·등록·수정
│  │  ├─ releases/
│  │  ├─ changelog/
│  │  └─ stats/
│  └─ api/
│     ├─ download/[releaseId]/route.ts
│     └─ auth/callback/route.ts
├─ components/
│  ├─ ui/          Button, Tag, Rule, MonoLabel, SpecTable …
│  ├─ product/     ProductRow, FeaturedProduct, ScreenshotFrame …
│  └─ layout/      Nav, Footer, LocaleSwitcher
├─ lib/
│  ├─ supabase/    client.ts · server.ts · admin.ts
│  └─ queries/     제품·릴리스·기록 조회 함수
├─ i18n/
│  ├─ routing.ts   지원 언어 목록, 접두사 정책
│  ├─ request.ts   요청별 메시지 조립 (폴백 체인)
│  └─ navigation.ts 언어 접두사를 붙이는 Link·redirect
├─ messages/       ko.json · en.json · ja.json … (10개)
├─ proxy.ts        언어 감지·리다이렉트 (구 middleware.ts)
├─ scripts/
│  ├─ brand.mjs      로고 PNG 분석·분할
│  └─ i18n-check.mjs 번역 키 검사 (빌드 앞에 걸려 있음)
├─ supabase/
│  └─ migrations/
└─ docs/
```

### Next.js 16에서 달라진 것

문서를 보고 따라 하다 막히기 쉬운 지점이라 적어둔다.

| 항목 | 예전 | 지금 |
| --- | --- | --- |
| 미들웨어 파일 | `middleware.ts`, `export function middleware` | **`proxy.ts`, `export function proxy`** |
| `params` | 동기 객체 | **`Promise`** — `const { locale } = await params` |
| 루트 동적 세그먼트 | props로 전달 | `next/root-params`로 어디서나 조회 가능 (Route Handler는 아직 불가) |

next-intl 공식 문서는 아직 `middleware.ts` 기준이다. `proxy.ts`에서 이름만 맞춰주면 동작은 같다.

**규칙**
- 데이터 조회는 `lib/queries/*`에만 둔다. 컴포넌트에서 Supabase를 직접 부르지 않는다.
- 관리자 권한 검사는 `app/admin/layout.tsx` 한 곳에서 한다. 페이지마다 반복하지 않는다.
- `lib/supabase/admin.ts`(service role 키)는 서버에서만 import 한다.

## 3. 데이터베이스

### 3.1 설계 원칙

- **번역은 별도 테이블로 분리한다.** 본체에 `name_ko`, `name_en` … 을 10벌 넣으면 언어 추가 때마다 스키마가 바뀐다.
- **가격 컬럼은 지금 넣어둔다.** 값은 전부 무료(`is_free = true`)지만, 나중에 컬럼을 추가하며 마이그레이션하는 것보다 낫다.
- **다운로드 기록은 릴리스 단위로 남긴다.** "몇 명이 v1.1.0에서 v1.2.0으로 올라갔는지"를 알 수 있어야 한다.

### 3.2 스키마

실제 SQL은 `supabase/migrations/` 에 있다. 아래는 요약이다.

```sql
-- ── 분류 ────────────────────────────────────────────
-- 이름은 여기 두지 않는다. messages/*.json 의 category.<slug> 를 쓴다.
-- 분류는 5개 고정이고 이름은 UI 문구라서, DB에 두면 5×10=50행을 이중 관리하게 된다.
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,       -- office | games | utilities | webapps | labs
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ── 제품 ────────────────────────────────────────────
create type product_kind   as enum ('download', 'webapp', 'source');
create type product_status as enum ('draft', 'published', 'archived');

create table products (
  id             uuid primary key default gen_random_uuid(),
  slug           text unique not null,
  category_id    uuid references categories(id),
  kind           product_kind   not null default 'download',
  status         product_status not null default 'draft',

  -- 표시
  icon_letter    text,                    -- 아이콘 대신 쓰는 한 글자
  cover_path     text,                    -- Supabase Storage 경로
  platforms      text[] default '{}',     -- {windows, macos, linux}
  is_featured    boolean not null default false,

  -- 연결
  external_url   text,                    -- kind='webapp' 일 때 열 주소
  github_repo    text,                    -- 'snail5039-code/file-organizer'
  source_url     text,                    -- kind='source' 일 때

  -- 접근
  requires_login boolean not null default true,

  -- 2단계 대비 (지금은 전부 무료)
  is_free        boolean not null default true,
  price_krw      int,
  checkout_url   text,                    -- Gumroad / Lemon Squeezy 주소

  download_count int not null default 0,  -- 캐시값. 정본은 downloads 테이블
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table product_translations (
  product_id  uuid references products(id) on delete cascade,
  locale      text not null,
  name        text not null,
  tagline     text,                       -- 목록에 뜨는 한 줄
  description text,                       -- 마크다운
  requirements text,                      -- 시스템 요구사항
  is_reviewed boolean not null default false,   -- 사람이 검수했는가
  primary key (product_id, locale)
);

-- ── 스크린샷 ────────────────────────────────────────
create table product_images (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid references products(id) on delete cascade,
  storage_path text not null,
  alt_ko      text,
  alt_en      text,
  sort_order  int not null default 0
);

-- ── 릴리스 ──────────────────────────────────────────
create table releases (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid references products(id) on delete cascade,
  version      text not null,                    -- '1.2.0'
  channel      text not null default 'stable',   -- stable | beta
  platform     text not null default 'windows',
  asset_url    text not null,                    -- GitHub Releases 직링크
  file_size    bigint,                           -- bytes
  checksum     text,                             -- sha256
  is_latest    boolean not null default false,
  released_at  timestamptz not null default now(),
  unique (product_id, version, platform)
);

create table release_notes (
  release_id uuid references releases(id) on delete cascade,
  locale     text not null,
  body       text not null,
  primary key (release_id, locale)
);

-- ── 개발 기록 ───────────────────────────────────────
create table changelog_entries (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete set null,  -- 스튜디오 전체 소식이면 null
  entry_date date not null,
  created_at timestamptz not null default now()
);

create table changelog_translations (
  entry_id uuid references changelog_entries(id) on delete cascade,
  locale   text not null,
  body     text not null,
  primary key (entry_id, locale)
);

-- ── 사용자 ──────────────────────────────────────────
create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  display_name      text,
  locale            text not null default 'ko',
  role              text not null default 'user',   -- user | admin
  notify_updates    boolean not null default true,  -- 받은 제품의 새 버전 알림
  created_at        timestamptz not null default now()
);

create table downloads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  release_id  uuid references releases(id) on delete set null,
  locale      text,
  created_at  timestamptz not null default now()
);
create index on downloads (user_id, created_at desc);
create index on downloads (product_id, created_at desc);

-- ── 2단계 대비: 지금은 만들지만 쓰지 않는다 ──────────
create table entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  source      text not null,          -- free | gumroad | manual
  license_key text unique,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  unique (user_id, product_id)
);
```

### 3.3 RLS 요약

| 테이블 | 읽기 | 쓰기 |
| --- | --- | --- |
| `products`, `product_translations`, `product_images`, `releases`, `release_notes` | `status = 'published'` 인 것만 누구나 | admin만 |
| `categories`, `category_translations` | 누구나 | admin만 |
| `changelog_entries`, `changelog_translations` | 누구나 | admin만 |
| `profiles` | 본인 것만 | 본인 것만 (`role` 컬럼 제외) |
| `downloads` | 본인 것만 | insert는 service role만 (API 라우트) |
| `entitlements` | 본인 것만 | service role만 |

`role` 컬럼은 사용자가 스스로 바꿀 수 없다. 컬럼 단위 제어는 정책으로 표현하기 어려워
`profiles_protect_role` 트리거가 관리자가 아닌 변경을 되돌린다.
admin 판정은 `auth.jwt()`가 아니라 `profiles.role`을 조회하는 `is_admin()` 함수로 한다.
JWT를 안 보므로 권한을 바꾸면 다시 로그인하지 않아도 즉시 반영된다.

### 함수 실행 권한 — 두 번 데인 곳

**Postgres는 함수를 만들 때 `EXECUTE`를 자동으로 `PUBLIC`에 부여한다.**
`anon`은 `PUBLIC`에 속하므로 `revoke ... from anon`만 해서는 아무 효과가 없다.
반드시 `revoke ... from public`부터 해야 한다.

그런데 전부 잠그면 안 된다. 함수를 **누가 부르는지**로 갈린다.

| 함수 | 호출 주체 | anon 권한 |
| --- | --- | --- |
| `record_download()` | 앱 코드 | **없어야 함** |
| `is_admin()` | **RLS 정책 자신** | **있어야 함** |

`is_admin()`을 anon에게서 회수하면 공개 제품 조회가 통째로 막힌다. 정책이

```sql
using (status = 'published' or public.is_admin())
```

이고 `to anon`으로 걸려 있어서, anon이 조회할 때도 이 함수가 평가된다.
SQL의 `or`는 왼쪽이 참이라고 오른쪽을 건너뛴다는 보장이 없다.
anon에게 돌려줘도 새는 정보는 없다 — 로그인하지 않으면 `auth.uid()`가 null이라 언제나 `false`다.

### 검사

`node scripts/db-check.mjs`가 원격 DB에 대고 스키마와 접근 제어를 함께 본다.
테이블 11개 존재, 분류 5개 공개 조회, 개인 데이터가 anon에게 0행, `record_download`가
anon에게 `42501 permission denied`인지까지. 키 값은 출력하지 않는다.

RLS 변경 뒤에는 이걸 돌린다. 위의 `is_admin` 문제는 화면을 만들기 전에 이 스크립트가 잡아냈다.

## 4. 다운로드 흐름

```
사용자가 [받기] 클릭
        │
        ▼
GET /api/download/{releaseId}
        │
        ├─ 세션 없음  ──▶ 302 /{locale}/login?next=/products/{slug}
        │
        ├─ 제품이 published 아님 ──▶ 404
        │
        ├─ downloads insert
        ├─ products.download_count 증가 (RPC, 원자적)
        │
        └─▶ 302 release.asset_url   (GitHub Releases)
```

- 카운터 증가는 애플리케이션에서 `count + 1` 하지 않고 `increment_download_count(product_id)` RPC로 처리한다. 동시 요청에서 값이 덮어써지는 것을 막기 위함.
- 같은 사용자가 같은 릴리스를 여러 번 받으면 기록은 매번 남기되, `download_count`는 최초 1회만 올린다.
- 웹앱(`kind='webapp'`)은 이 경로를 타지 않는다. 클라이언트에서 `external_url`을 새 창으로 연다.

**알려진 한계**: `asset_url`이 GitHub의 공개 주소이므로, 그 주소를 직접 아는 사람은 로그인 없이 받을 수 있다.
1단계는 전부 무료라 수용한다. 유료 제품 도입 시 해당 제품만 Supabase Storage로 옮기고, 이 라우트가 5분 만료 서명 URL을 발급하도록 바꾼다. 라우트의 외부 계약(`/api/download/{releaseId}`)은 그대로 유지된다.

## 5. 인증

- **Google OAuth**와 **이메일 매직 링크** 두 가지. 비밀번호는 받지 않는다.
- 콜백은 `/api/auth/callback`에서 코드를 세션으로 교환하고, `next` 파라미터로 되돌린다.
- 가입 직후 `profiles` 행을 만드는 트리거를 둔다.

```sql
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

- 회원 탈퇴는 `auth.users` 삭제 → cascade로 `profiles`, `downloads`가 함께 지워진다.
  통계를 남기고 싶다면 삭제 전에 집계 테이블로 옮기는 단계를 추가한다. (PRD 남은 결정 사항)

## 6. 다국어

### 지원 언어

| 코드 | 언어 | 우선순위 |
| --- | --- | --- |
| `ko` | 한국어 | 기본 |
| `en` | English | 폴백 |
| `ja` | 日本語 | 2 |
| `zh-CN` | 简体中文 | 2 |
| `zh-TW` | 繁體中文 | 3 |
| `es` | Español | 3 |
| `pt-BR` | Português (BR) | 3 |
| `de` | Deutsch | 3 |
| `fr` | Français | 3 |
| `ru` | Русский | 3 |

### 두 종류의 문구를 다르게 다룬다

| | 화면 문구 (버튼·라벨·안내) | 콘텐츠 (제품 설명·개발 기록) |
| --- | --- | --- |
| 저장 위치 | `messages/{locale}.json` | DB `*_translations` 테이블 |
| 필수 여부 | 10개 언어 전부 필수 | ko + en만 필수 |
| 미번역 시 | 배포 전 검사에서 걸러냄 | 영어로 폴백, 없으면 한국어 |

### 폴백 순서

```
요청 언어 → en → ko
```

화면 문구는 `i18n/request.ts`가 세 겹을 겹쳐서 하나의 메시지 묶음으로 만든다.
**키가 없을 때뿐 아니라 값이 빈 문자열일 때도 폴백한다** — 번역 중인 항목을 `""`로 남겨둬도 화면이 비지 않는다.

겹치는 순서에 함정이 하나 있다. 단순히 `ko → en → 요청언어` 순으로 덮으면
한국어 페이지에서 en이 ko를 덮어써 버린다. 요청 언어가 항상 마지막에 오도록
중복을 제거한 뒤 겹친다.

| 요청 | 겹치는 순서 (뒤가 우선) |
| --- | --- |
| `ko` | en → **ko** |
| `en` | ko → **en** |
| `ja` | ko → en → **ja** |

제품 설명 등 DB 콘텐츠는 `lib/queries/`의 조회 함수가 같은 순서를 적용한다.

### 검사

`npm run i18n:check`가 `ko.json`을 기준으로 나머지 9개 언어의 누락·빈 값·잉여 키를 본다.
`npm run build` 앞에 걸려 있어서, 번역이 빠진 채로는 배포가 되지 않는다.

### 라우팅

- `/ko/products/file-organizer` 형태. 기본 언어도 접두사를 붙인다 (`localePrefix: 'always'`) — SEO와 링크 공유가 단순해진다.
- 최초 방문 시 `Accept-Language`로 추정해 리다이렉트하고, 이후에는 쿠키를 따른다.
- `<link rel="alternate" hreflang>`을 10개 언어 + `x-default`(ko)로 넣는다.
- `sitemap.xml`은 언어별 URL을 모두 포함한다.
- 폴백으로 표시된 페이지는 `noindex` 처리한다. 영어 내용이 10개 언어 URL에 중복 노출되면 검색 품질에 해가 된다.

### 관리자 화면

제품 편집 화면에 언어 탭 10개를 두고, 각 탭에 `작성됨 / 검수됨 / 비어 있음` 상태를 표시한다.
목록에서는 `번역 3/10` 형태로 진행률을 보여준다.

## 7. 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # 서버 전용. 클라이언트에 절대 노출 금지
NEXT_PUBLIC_SITE_URL=           # OAuth 콜백에 필요
```

## 8. 성능·운영

- 공개 화면은 서버 컴포넌트에서 조회하고 `revalidate = 300`으로 캐시한다. 제품 정보는 자주 안 바뀐다.
- 관리자에서 저장하면 해당 경로만 `revalidatePath`로 무효화한다.
- 스크린샷은 Supabase Storage에 두고 `next/image`로 최적화한다.
- 다운로드 API는 캐시하지 않는다 (`dynamic = 'force-dynamic'`).
