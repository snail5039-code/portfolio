-- HyukForge 초기 스키마
-- 설계 근거: docs/ARCHITECTURE.md 3장
--
-- 원칙
--  1. 번역은 별도 테이블로 분리한다. 본체에 name_ko/name_en을 10벌 넣으면
--     언어를 추가할 때마다 스키마가 바뀐다.
--  2. 가격·이용권 컬럼은 지금 만들어 둔다. 값은 전부 무료지만,
--     나중에 컬럼을 추가하는 것보다 비워두는 편이 낫다.
--  3. 다운로드 기록은 릴리스 단위로 남긴다.
--     "몇 명이 v1.1.0에서 v1.2.0으로 올라갔는가"를 알 수 있어야 한다.

-- ── 공통 ────────────────────────────────────────────────────────

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── 분류 ────────────────────────────────────────────────────────
-- 이름은 여기 두지 않는다. messages/*.json의 category.<slug>를 쓴다.
-- 분류는 5개 고정이고 이름은 UI 문구라서, DB에 두면 10개 언어를 이중 관리하게 된다.

create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_slug_known check (
    slug in ('office', 'games', 'utilities', 'webapps', 'labs')
  )
);

-- ── 제품 ────────────────────────────────────────────────────────

create type public.product_kind   as enum ('download', 'webapp', 'source');
create type public.product_status as enum ('draft', 'published', 'archived');

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  category_id uuid references public.categories(id) on delete restrict,
  kind        public.product_kind   not null default 'download',
  status      public.product_status not null default 'draft',

  -- 표시
  icon_letter text,                     -- 아이콘 대신 쓰는 한 글자
  cover_path  text,                     -- Supabase Storage 경로
  platforms   text[] not null default '{}',   -- {windows, macos, linux}
  is_featured boolean not null default false,

  -- 연결
  external_url text,                    -- kind='webapp'일 때 열 주소
  github_repo  text,                    -- 'snail5039-code/file-organizer'
  source_url   text,                    -- kind='source'일 때

  -- 접근
  requires_login boolean not null default true,

  -- 2단계(판매) 대비. 지금은 전부 무료다.
  is_free      boolean not null default true,
  price_krw    int,
  checkout_url text,                    -- Gumroad / Lemon Squeezy 주소

  -- 캐시값. 정본은 downloads 테이블이다.
  download_count int not null default 0,

  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- 웹앱은 열 주소가 있어야 하고, 다운로드 제품은 릴리스로 배포한다
  constraint products_webapp_needs_url check (
    kind <> 'webapp' or external_url is not null
  ),
  -- 발행된 제품은 발행 시각이 있어야 한다
  constraint products_published_needs_date check (
    status <> 'published' or published_at is not null
  ),
  -- 유료 제품은 가격과 결제 주소가 같이 있어야 한다
  constraint products_paid_needs_price check (
    is_free or (price_krw is not null and checkout_url is not null)
  )
);

create index products_category_idx on public.products (category_id);
create index products_status_idx    on public.products (status, published_at desc);

create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

create table public.product_translations (
  product_id   uuid not null references public.products(id) on delete cascade,
  locale       text not null,
  name         text not null,
  tagline      text,          -- 목록에 뜨는 한 줄
  description  text,          -- 마크다운
  requirements text,          -- 시스템 요구사항
  -- 기계번역을 사람이 한 번 훑었는가. 어드민의 번역 진행률에 쓴다.
  is_reviewed  boolean not null default false,
  primary key (product_id, locale)
);

create table public.product_images (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_ko       text,
  alt_en       text,
  sort_order   int  not null default 0
);

create index product_images_product_idx on public.product_images (product_id, sort_order);

-- ── 릴리스 ──────────────────────────────────────────────────────
-- asset_url은 GitHub Releases의 공개 주소다.
-- 유료 제품이 생기면 그 제품만 Supabase Storage로 옮기고 서명 URL을 발급한다.

create table public.releases (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  version     text not null,                  -- '1.2.0'
  channel     text not null default 'stable', -- stable | beta
  platform    text not null default 'windows',
  asset_url   text not null,
  file_size   bigint,                         -- bytes
  checksum    text,                           -- sha256
  is_latest   boolean not null default false,
  released_at timestamptz not null default now(),
  unique (product_id, version, platform),
  constraint releases_channel_known check (channel in ('stable', 'beta'))
);

-- 제품·플랫폼당 최신 릴리스는 하나뿐이다
create unique index releases_one_latest
  on public.releases (product_id, platform)
  where is_latest;

create index releases_product_idx on public.releases (product_id, released_at desc);

create table public.release_notes (
  release_id uuid not null references public.releases(id) on delete cascade,
  locale     text not null,
  body       text not null,
  primary key (release_id, locale)
);

-- ── 개발 기록 ───────────────────────────────────────────────────

create table public.changelog_entries (
  id         uuid primary key default gen_random_uuid(),
  -- 스튜디오 전체 소식이면 null
  product_id uuid references public.products(id) on delete set null,
  entry_date date not null,
  created_at timestamptz not null default now()
);

create index changelog_date_idx on public.changelog_entries (entry_date desc);

create table public.changelog_translations (
  entry_id uuid not null references public.changelog_entries(id) on delete cascade,
  locale   text not null,
  body     text not null,
  primary key (entry_id, locale)
);

-- ── 사용자 ──────────────────────────────────────────────────────

create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  locale         text not null default 'ko',
  role           text not null default 'user',
  -- 받은 제품에 새 버전이 올라오면 알린다
  notify_updates boolean not null default true,
  created_at     timestamptz not null default now(),
  constraint profiles_role_known check (role in ('user', 'admin'))
);

create table public.downloads (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  release_id uuid references public.releases(id) on delete set null,
  locale     text,
  created_at timestamptz not null default now()
);

create index downloads_user_idx    on public.downloads (user_id, created_at desc);
create index downloads_product_idx on public.downloads (product_id, created_at desc);

-- ── 이용권 (2단계 대비) ─────────────────────────────────────────
-- 지금은 아무것도 쓰지 않는다. 무료 배포에는 필요 없다.

create table public.entitlements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_id  uuid not null references public.products(id) on delete cascade,
  source      text not null default 'free',   -- free | gumroad | manual
  license_key text unique,
  granted_at  timestamptz not null default now(),
  expires_at  timestamptz,
  unique (user_id, product_id),
  constraint entitlements_source_known check (source in ('free', 'gumroad', 'manual'))
);

-- ── 가입 시 프로필 생성 ─────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'full_name'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
