-- 공지를 언제 올렸다 내렸다 했는지 남긴다.
--
-- 왜 필요한가
--   지금은 공지 행 하나에 현재 상태만 있다. "이 공지를 언제 내렸더라",
--   "저 공지는 올린 적이 있나"를 물어볼 곳이 없다. 발행일(published_at)은
--   마지막으로 올린 시각 하나뿐이라 내린 기록은 아예 남지 않는다.
--
-- 왜 트리거인가
--   올리고 내리는 자리가 한 곳이 아니다 — 공지 수정 화면에서도 바꾸고,
--   목록에서 바로도 바꾼다(관리자 화면). 애플리케이션 코드에서 남기면
--   경로가 늘어날 때마다 기록을 빠뜨린다. 테이블에 붙여두면
--   어디서 바꾸든 무조건 남는다.
--
-- 남기지 않는 것
--   본문이 어떻게 바뀌었는지는 남기지 않는다. 번역 10개 언어의 전문을
--   버전마다 쌓으면 이력이 본문보다 커지고, 알고 싶은 건 "무엇을 썼나"가
--   아니라 "언제부터 언제까지 보였나"다.

create table public.notice_events (
  id          bigint generated always as identity primary key,
  -- 공지를 지워도 이력은 남는다. 그래서 cascade 가 아니라 set null 이고,
  -- 무엇에 대한 기록인지 알 수 있게 slug 를 그때 값으로 같이 박아둔다.
  notice_id   uuid references public.notices(id) on delete set null,
  slug        text not null,
  action      text not null,
  from_status text,
  to_status   text,
  actor_id    uuid references auth.users(id) on delete set null,
  -- 계정이 사라져도 누가 했는지는 남아야 한다. 조인 대신 그때 값을 적는다.
  actor_email text,
  at          timestamptz not null default now(),
  constraint notice_events_action_known check (action in (
    'created', 'published', 'unpublished', 'archived', 'drafted',
    'pinned', 'unpinned', 'deleted'
  ))
);

comment on table public.notice_events is '공지를 올리고 내린 기록. 트리거가 남기고 관리자만 읽는다.';

create index notice_events_recent_idx on public.notice_events (at desc);
create index notice_events_notice_idx on public.notice_events (notice_id, at desc);

-- ── 기록 ────────────────────────────────────────────────────────

create or replace function public.log_notice_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_email text;
begin
  select u.email into v_email from auth.users u where u.id = v_actor;

  if tg_op = 'INSERT' then
    insert into public.notice_events
      (notice_id, slug, action, from_status, to_status, actor_id, actor_email)
    values (
      new.id, new.slug,
      -- 만들자마자 발행하는 경우가 있다. 그때는 '올림'으로 적는 게 맞다 —
      -- '만듦'만 남으면 언제부터 보였는지가 이력에서 빠진다.
      case when new.status = 'published' then 'published' else 'created' end,
      null, new.status, v_actor, v_email
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.notice_events
      (notice_id, slug, action, from_status, to_status, actor_id, actor_email)
    values (null, old.slug, 'deleted', old.status, null, v_actor, v_email);
    return old;
  end if;

  -- 상태와 고정은 따로 센다. 한 번 저장할 때 둘 다 바뀌면 두 줄이 남는다.
  if new.status is distinct from old.status then
    insert into public.notice_events
      (notice_id, slug, action, from_status, to_status, actor_id, actor_email)
    values (
      new.id, new.slug,
      case
        when new.status = 'published'                          then 'published'
        when old.status = 'published' and new.status = 'draft' then 'unpublished'
        when new.status = 'archived'                           then 'archived'
        else 'drafted'
      end,
      old.status, new.status, v_actor, v_email
    );
  end if;

  if new.is_pinned is distinct from old.is_pinned then
    insert into public.notice_events
      (notice_id, slug, action, from_status, to_status, actor_id, actor_email)
    values (
      new.id, new.slug,
      case when new.is_pinned then 'pinned' else 'unpinned' end,
      old.status, new.status, v_actor, v_email
    );
  end if;

  return new;
end;
$$;

-- 트리거 함수라 직접 부를 일이 없다. 열어둘 이유도 없다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.log_notice_event() from public;
revoke execute on function public.log_notice_event() from anon;
revoke execute on function public.log_notice_event() from authenticated;

create trigger notices_log_event
  after insert or update or delete on public.notices
  for each row execute function public.log_notice_event();

-- ── 접근 제어 ───────────────────────────────────────────────────
-- 읽기는 관리자만. 쓰기 정책은 두지 않는다 —
-- 유일한 경로가 위 트리거이고, security definer 라 정책을 타지 않는다.
-- (다운로드 기록과 같은 규칙: 20260817000002_rls.sql)

alter table public.notice_events enable row level security;

create policy "공지 이력은 관리자만" on public.notice_events
  for select to authenticated
  using (public.is_admin());
