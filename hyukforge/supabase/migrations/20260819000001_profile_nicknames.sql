-- 게시판 글쓴이 이름.
--
-- 왜 profiles 를 그대로 열지 않는가
--   RLS 는 행 단위다. profiles 를 공개로 열면 닉네임만이 아니라
--   display_name(구글 실명)·role·notify_updates 까지 같이 나간다.
--   보여주고 싶은 건 닉네임 하나뿐이라, 그것만 담은 뷰를 따로 둔다.
--
-- 왜 display_name 을 쓰지 않는가
--   가입할 때 구글에서 받아온 실명이다. 본인 확인용으로는 쓰되
--   게시판에 그대로 띄우면 안 된다. 닉네임은 사용자가 직접 정한다.

alter table public.profiles
  add column nickname text;

-- 대소문자를 무시하고 유일하게.
-- 같은 이름이 둘이면 게시판에서 누가 누구인지 구분할 수 없다.
create unique index profiles_nickname_unique
  on public.profiles (lower(nickname))
  where nickname is not null;

-- 글자 종류를 허용 목록으로 좁히지 않는다. 10개 언어를 쓰는 사이트라
-- 한글·영문만 받으면 나머지 언어 사용자가 이름을 못 만든다.
-- 대신 제어문자·연속 공백·앞뒤 공백만 막는다.
-- '#' 로 시작하는 것도 막는다 — 닉네임이 없을 때 보여주는 #a3f19c 를 흉내 낼 수 있다.
alter table public.profiles
  add constraint profiles_nickname_shape check (
    nickname is null or (
      char_length(nickname) between 2 and 20
      and nickname = btrim(nickname)
      and nickname !~ '[[:cntrl:]]'
      and nickname !~ '\s\s'
      and nickname !~ '^#'
    )
  );

-- ── 공개 뷰 ──────────────────────────────────────────────────────
-- security_invoker = false 라서 이 뷰는 소유자 권한으로 돈다.
-- 즉 profiles 의 RLS 를 우회한다 — 그래서 여기 적힌 컬럼 목록이 유일한 방어선이다.
-- **컬럼을 늘리지 말 것.** 늘리는 순간 그대로 공개된다.

create view public.public_profiles
  with (security_invoker = false)
  as select id, nickname
       from public.profiles
      where nickname is not null;

-- 뷰도 함수와 같다. PUBLIC 에 붙는 권한부터 걷어내고 필요한 롤에만 준다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

-- 닉네임 수정은 기존 "프로필 수정은 본인만" 정책이 이미 허용한다.
-- role 은 profiles_protect_role 트리거가 계속 되돌린다.
