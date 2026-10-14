-- 회원 관리.
--
-- 관리자 화면에 회원 목록이 없었다. 가입자가 누구인지, 몇 명인지,
-- 관리자가 누구인지 확인할 방법이 make-admin.mjs 스크립트뿐이었다.
--
-- 왜 테이블을 직접 읽지 않고 함수를 두는가
--   ① 이메일이 profiles 에 없다. auth.users 에 있고, 그 스키마는 PostgREST 가
--      내보내지 않는다. 그렇다고 profiles 에 이메일을 복사해 두면 두 곳이
--      어긋난다 — 사용자가 구글 계정 이메일을 바꾸면 사본은 그대로 남는다.
--   ② 권한 변경은 UPDATE 정책("프로필 수정은 본인만")이 막는다. 정책을
--      "또는 관리자"로 넓히면 관리자가 남의 닉네임·알림 설정까지 전부
--      덮어쓸 수 있게 된다. 바꿔야 하는 건 role 하나뿐이라 그것만 여는
--      함수를 만든다. (record_visit·record_download 와 같은 방침)
--
-- 계정 삭제는 여기 없다. auth.users 를 지우는 일이고, 게시글·댓글이
-- 함께 사라진다(on delete cascade). 되돌릴 수 없는 작업을 화면 버튼
-- 하나에 붙이지 않는다 — 필요하면 Supabase 대시보드에서 한다.

-- ── 목록 ────────────────────────────────────────────────────────
-- auth.users 를 읽어야 하므로 security definer 다. 그래서 첫 줄이
-- is_admin() 검사여야 한다 — 이 함수가 유일한 방어선이다.
--
-- 관리자가 아니면 예외 대신 0행을 돌려준다. 관리자 화면은 레이아웃에서
-- 이미 notFound() 로 막혀 있고(app/[locale]/admin/layout.tsx), 여기서
-- 예외를 던지면 "권한 없음"이라는 응답 자체가 함수의 존재를 알린다.

create or replace function public.admin_list_users()
returns table (
  id              uuid,
  email           text,
  display_name    text,
  nickname        text,
  role            text,
  locale          text,
  notify_updates  boolean,
  created_at      timestamptz,
  last_sign_in_at timestamptz,
  download_count  bigint,
  post_count      bigint,
  comment_count   bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    u.email::text,
    p.display_name,
    p.nickname,
    p.role,
    p.locale,
    p.notify_updates,
    p.created_at,
    u.last_sign_in_at,
    (select count(*) from public.downloads     d where d.user_id  = p.id),
    (select count(*) from public.posts         b where b.author_id = p.id),
    (select count(*) from public.post_comments c where c.author_id = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.is_admin()
  order by p.created_at desc;
$$;

comment on function public.admin_list_users() is
  '관리자용 회원 목록. auth.users 의 이메일·마지막 로그인을 함께 돌려준다. 관리자가 아니면 0행.';

revoke execute on function public.admin_list_users() from public;
grant  execute on function public.admin_list_users() to authenticated;

-- ── 권한 바꾸기 ─────────────────────────────────────────────────
-- profiles.role 만 건드린다. 나머지 컬럼은 이 경로로 바뀌지 않는다.
--
-- 자기 자신은 못 바꾼다. 실수로 스스로 관리자를 떼면 다시 붙일 화면이
-- 없어서 스크립트(scripts/make-admin.mjs)로 되돌려야 한다. 그리고 이
-- 규칙 덕분에 "관리자가 0명"이 될 수 없다 — 지금 누르고 있는 사람이 남는다.
--
-- protect_profile_role 트리거는 그대로 통과한다. 그 트리거는 is_admin()
-- 이면 되돌리지 않고, 이 함수는 첫 줄에서 그걸 이미 확인했다.
-- (supabase/migrations/20260818000001_fix_role_guard.sql)

create or replace function public.admin_set_role(target uuid, new_role text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  if new_role not in ('user', 'admin') then
    raise exception '알 수 없는 권한입니다.' using errcode = '22023';
  end if;

  if target = (select auth.uid()) then
    raise exception '자기 권한은 바꿀 수 없습니다.' using errcode = '22023';
  end if;

  update public.profiles set role = new_role where id = target;

  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_set_role(uuid, text) is
  '회원 권한(user|admin) 변경. 관리자만, 자기 자신은 제외.';

revoke execute on function public.admin_set_role(uuid, text) from public;
grant  execute on function public.admin_set_role(uuid, text) to authenticated;

-- ── 닉네임 지우기 ───────────────────────────────────────────────
-- 게시판에 그대로 노출되는 이름이다. 부적절한 닉네임을 발견했을 때
-- 계정을 건드리지 않고 이름만 비운다. 비우면 게시판은 #a3f19c 형태의
-- 자동 이름으로 돌아가고(components/board), 본인이 다시 정할 수 있다.
--
-- 닉네임을 관리자가 대신 지어 주지는 않는다. 그건 사용자 몫이다.

create or replace function public.admin_clear_nickname(target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '권한이 없습니다.' using errcode = '42501';
  end if;

  update public.profiles set nickname = null where id = target;

  if not found then
    raise exception '회원을 찾지 못했습니다.' using errcode = 'P0002';
  end if;
end;
$$;

comment on function public.admin_clear_nickname(uuid) is
  '닉네임만 비운다. 게시판 표시 이름이 자동 이름으로 돌아간다.';

revoke execute on function public.admin_clear_nickname(uuid) from public;
grant  execute on function public.admin_clear_nickname(uuid) to authenticated;
