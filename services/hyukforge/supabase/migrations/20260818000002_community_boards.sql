-- 사용자 게시판. 자유게시판과 요청 게시판("만들어주세요").
--
-- 왜 notices 와 합치지 않는가
--   notices 는 내가 쓰는 글이라 10개 언어 번역이 붙는다.
--   사용자 글은 작성자가 쓴 언어 그대로 보여주는 게 맞다 — 번역할 대상이 아니다.
--   같은 테이블에 넣으면 번역 유무로 갈리는 분기가 계속 생긴다.
--
-- 요청 게시판에는 상태와 공감 수를 둔다. "검토 중"인지 "이미 만들었는지"를
-- 알 수 없으면 같은 요청이 반복해서 올라온다.

create type public.post_board  as enum ('free', 'request');
create type public.post_status as enum ('published', 'hidden');
-- 요청 게시판에서만 쓴다
create type public.request_state as enum ('open', 'planned', 'in_progress', 'done', 'declined');

create table public.posts (
  id         uuid primary key default gen_random_uuid(),
  board      public.post_board  not null,
  author_id  uuid not null references auth.users(id) on delete cascade,

  title      text not null,
  body       text not null,
  -- 작성 언어를 기록해둔다. 번역하지는 않지만 목록에서 표시할 수 있다.
  locale     text not null default 'ko',

  -- 관리자만 바꿀 수 있다 (아래 트리거)
  status         public.post_status not null default 'published',
  is_pinned      boolean not null default false,
  request_state  public.request_state,

  -- 매번 세지 않도록 트리거로 관리한다
  comment_count int not null default 0,
  vote_count    int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint posts_title_len check (char_length(btrim(title)) between 2 and 120),
  constraint posts_body_len  check (char_length(btrim(body))  between 2 and 20000),
  -- 요청 상태는 요청 게시판에만
  constraint posts_state_only_request check (
    board = 'request' or request_state is null
  )
);

create index posts_board_idx
  on public.posts (board, is_pinned desc, created_at desc)
  where status = 'published';
create index posts_author_idx on public.posts (author_id, created_at desc);

create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

create table public.post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  author_id  uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  status     public.post_status not null default 'published',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_comments_body_len check (char_length(btrim(body)) between 1 and 5000)
);

create index post_comments_post_idx on public.post_comments (post_id, created_at);

create trigger post_comments_touch_updated_at
  before update on public.post_comments
  for each row execute function public.touch_updated_at();

-- 공감. 한 사람이 한 글에 한 번만.
create table public.post_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- ── 관리자 전용 컬럼 보호 ────────────────────────────────────────
-- profiles.role 과 같은 문제다. 컬럼 단위 제어는 정책으로 표현하기 어려워
-- 트리거로 되돌린다.
-- SECURITY DEFINER 를 쓰지 않는다 — 그러면 current_user 가 함수 소유자로 바뀌어
-- 접근 주체를 판단할 수 없다. (20260818000001 에서 겪은 문제)

create or replace function public.protect_post_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' and not public.is_admin() then
    new.status        := old.status;
    new.is_pinned     := old.is_pinned;
    new.request_state := old.request_state;
    -- 글쓴이를 바꿔치기하는 것도 막는다
    new.author_id     := old.author_id;
    new.board         := old.board;
  end if;
  return new;
end;
$$;

create trigger posts_protect_admin_fields
  before update on public.posts
  for each row execute function public.protect_post_admin_fields();

create or replace function public.protect_comment_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role' and not public.is_admin() then
    new.status    := old.status;
    new.author_id := old.author_id;
    new.post_id   := old.post_id;
  end if;
  return new;
end;
$$;

create trigger post_comments_protect_admin_fields
  before update on public.post_comments
  for each row execute function public.protect_comment_admin_fields();

-- ── 집계 유지 ────────────────────────────────────────────────────
-- 목록에서 매번 count(*) 하지 않도록 트리거로 세어둔다.

create or replace function public.sync_comment_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.posts p
     set comment_count = (
       select count(*) from public.post_comments c
        where c.post_id = p.id and c.status = 'published'
     )
   where p.id = coalesce(new.post_id, old.post_id);
  return null;
end;
$$;

create trigger post_comments_sync_count
  after insert or update or delete on public.post_comments
  for each row execute function public.sync_comment_count();

create or replace function public.sync_vote_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.posts p
     set vote_count = (select count(*) from public.post_votes v where v.post_id = p.id)
   where p.id = coalesce(new.post_id, old.post_id);
  return null;
end;
$$;

create trigger post_votes_sync_count
  after insert or delete on public.post_votes
  for each row execute function public.sync_vote_count();

-- ── 도배 제동 ────────────────────────────────────────────────────
-- 스팸을 완전히 막지는 못한다. 자동 도배만 늦춘다.
-- 사람 손으로 쓰는 속도로는 걸리지 않는 수치다.

create or replace function public.can_write_post()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.posts
     where author_id = (select auth.uid())
       and created_at > now() - interval '5 minutes'
  ) < 5;
$$;

create or replace function public.can_write_comment()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select count(*) from public.post_comments
     where author_id = (select auth.uid())
       and created_at > now() - interval '1 minute'
  ) < 10;
$$;

-- 함수는 만들자마자 EXECUTE 가 PUBLIC 에 붙는다. 명시적으로 정리한다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.can_write_post()    from public;
revoke execute on function public.can_write_comment() from public;
grant  execute on function public.can_write_post()    to authenticated;
grant  execute on function public.can_write_comment() to authenticated;

-- 정책이 이 함수들을 부르므로 anon 에게도 실행 권한이 필요하다.
-- 로그인하지 않으면 auth.uid() 가 null 이라 결과는 언제나 false 다.
grant execute on function public.can_write_post()    to anon;
grant execute on function public.can_write_comment() to anon;

-- ── 접근 제어 ────────────────────────────────────────────────────

alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_votes    enable row level security;

create policy "발행된 글은 공개" on public.posts
  for select to anon, authenticated
  using (
    status = 'published'
    or author_id = (select auth.uid())   -- 숨겨진 내 글은 나에게 보인다
    or public.is_admin()
  );

create policy "로그인하면 글을 쓸 수 있다" on public.posts
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'published'
    and is_pinned = false
    and public.can_write_post()
  );

create policy "내 글만 고칠 수 있다" on public.posts
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());
-- 관리자 전용 컬럼은 posts_protect_admin_fields 트리거가 되돌린다

create policy "내 글만 지울 수 있다" on public.posts
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

create policy "발행된 댓글은 공개" on public.post_comments
  for select to anon, authenticated
  using (
    status = 'published'
    or author_id = (select auth.uid())
    or public.is_admin()
  );

create policy "로그인하면 댓글을 쓸 수 있다" on public.post_comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and status = 'published'
    and public.can_write_comment()
    -- 숨겨진 글에는 댓글을 달 수 없다
    and exists (
      select 1 from public.posts p
       where p.id = post_id and p.status = 'published'
    )
  );

create policy "내 댓글만 고칠 수 있다" on public.post_comments
  for update to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

create policy "내 댓글만 지울 수 있다" on public.post_comments
  for delete to authenticated
  using (author_id = (select auth.uid()) or public.is_admin());

-- 공감 수는 누구나 볼 수 있지만(posts.vote_count), 누가 눌렀는지는 본인만 안다
create policy "내 공감만 보인다" on public.post_votes
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "공감은 본인 것만 추가" on public.post_votes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.posts p
       where p.id = post_id and p.status = 'published'
    )
  );

create policy "공감은 본인 것만 취소" on public.post_votes
  for delete to authenticated
  using (user_id = (select auth.uid()));
