-- 알림.
--
-- 두 가지를 한 표로 다룬다.
--   · 내 글에 댓글이 달렸다        — 글쓴이에게
--   · 게시판에 새 글·댓글이 올라왔다 — 관리자에게
-- 받는 사람(user_id)만 다르고 나머지 구조는 같아서 표를 나눌 이유가 없다.
--
-- 메일은 보내지 않는다. 화면 안에서만 알린다.
-- 발송 수단을 붙이는 건 따로 정할 일이고, 그게 없다고 이 기능을 미룰 이유는 없다.
-- (docs/HANDOFF.md "지금은 안 만들기로 한 것")

create type public.notification_kind as enum (
  'comment_on_post',  -- 내 글에 댓글
  'new_post',         -- 관리자: 새 글
  'new_comment'       -- 관리자: 새 댓글
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  -- 받는 사람
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       public.notification_kind not null,
  -- 일으킨 사람. 계정이 사라져도 알림은 남는다 (누가 했는지만 지워진다)
  actor_id   uuid references auth.users(id) on delete set null,
  post_id    uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

-- 안 읽은 것부터 찾는 게 대부분이다
create index notifications_inbox_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);

-- ── 넣는 쪽 ──────────────────────────────────────────────────────
-- 트리거만 넣는다. insert 정책을 두지 않는 이유는 downloads 와 같다 —
-- 사용자가 남에게 알림을 만들어 보낼 수 있으면 그게 스팸 통로가 된다.

/** 관리자 id 목록. is_admin() 은 '나'만 보므로 따로 필요하다. */
create or replace function public.admin_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where role = 'admin';
$$;

create or replace function public.notify_on_post()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 숨겨진 글은 알리지 않는다
  if new.status <> 'published' then
    return null;
  end if;

  insert into public.notifications (user_id, kind, actor_id, post_id)
  select a, 'new_post', new.author_id, new.id
    from public.admin_ids() a
   -- 관리자가 자기 글을 쓰고 자기한테 알림받을 이유가 없다
   where a <> new.author_id;

  return null;
end;
$$;

create trigger posts_notify
  after insert on public.posts
  for each row execute function public.notify_on_post();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_author uuid;
begin
  if new.status <> 'published' then
    return null;
  end if;

  select author_id into v_author from public.posts where id = new.post_id;

  -- 글쓴이에게. 자기 글에 자기가 단 댓글은 빼고.
  if v_author is not null and v_author <> new.author_id then
    insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
    values (v_author, 'comment_on_post', new.author_id, new.post_id, new.id);
  end if;

  -- 관리자에게. 방금 글쓴이로 보낸 사람과 겹치면 두 번 가지 않게 뺀다.
  insert into public.notifications (user_id, kind, actor_id, post_id, comment_id)
  select a, 'new_comment', new.author_id, new.post_id, new.id
    from public.admin_ids() a
   where a <> new.author_id
     and a is distinct from v_author;

  return null;
end;
$$;

create trigger post_comments_notify
  after insert on public.post_comments
  for each row execute function public.notify_on_comment();

-- 함수는 만들자마자 EXECUTE 가 PUBLIC 에 붙는다.
-- 트리거 안에서만 쓰이므로 아무에게도 열지 않는다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.admin_ids()        from public, anon, authenticated;
revoke execute on function public.notify_on_post()   from public, anon, authenticated;
revoke execute on function public.notify_on_comment() from public, anon, authenticated;

-- ── 접근 제어 ────────────────────────────────────────────────────

alter table public.notifications enable row level security;

create policy "내 알림만 보인다" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "내 알림만 읽음 처리" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "내 알림만 지울 수 있다" on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));
-- insert 정책은 두지 않는다. 트리거(정의자 권한)만이 유일한 경로다.
