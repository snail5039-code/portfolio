-- 두 가지를 더한다.
--  1. 공지 게시판 — 스튜디오 소식. 개발 기록(changelog)과 다르다.
--     개발 기록은 "무엇을 고쳤다"이고, 공지는 "알아두셔야 할 것"이다.
--  2. 제품 미리보기 — 받기 전에 확인할 수 있는 영상·체험 주소.
--     스크린샷은 이미 product_images 에 있다.

-- ── 공지 게시판 ─────────────────────────────────────────────────

create table public.notices (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  status       text not null default 'draft',
  -- 목록 맨 위에 고정. 중요한 공지 하나를 위에 붙여두려는 것.
  is_pinned    boolean not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint notices_status_known check (status in ('draft', 'published', 'archived')),
  constraint notices_published_needs_date check (
    status <> 'published' or published_at is not null
  )
);

create index notices_list_idx
  on public.notices (is_pinned desc, published_at desc)
  where status = 'published';

create trigger notices_touch_updated_at
  before update on public.notices
  for each row execute function public.touch_updated_at();

create table public.notice_translations (
  notice_id   uuid not null references public.notices(id) on delete cascade,
  locale      text not null,
  title       text not null,
  body        text not null,          -- 마크다운
  is_reviewed boolean not null default false,
  primary key (notice_id, locale)
);

-- ── 제품 미리보기 ───────────────────────────────────────────────

alter table public.products
  -- 브라우저에서 바로 해볼 수 있는 주소. iframe 으로 띄운다.
  -- 웹앱이면 자기 주소, 게임이면 웹 빌드 주소가 들어간다.
  add column demo_url  text,
  -- 동작 영상. YouTube 나 mp4 직링크.
  add column video_url text;

-- ── 접근 제어 ───────────────────────────────────────────────────
-- 제품과 같은 규칙이다. 발행분은 누구나, 쓰기는 관리자만.

alter table public.notices             enable row level security;
alter table public.notice_translations enable row level security;

create policy "발행된 공지는 공개" on public.notices
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy "공지 수정은 관리자만" on public.notices
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "발행된 공지의 번역은 공개" on public.notice_translations
  for select to anon, authenticated
  using (exists (
    select 1 from public.notices n
    where n.id = notice_id and (n.status = 'published' or public.is_admin())
  ));

create policy "공지 번역 수정은 관리자만" on public.notice_translations
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
