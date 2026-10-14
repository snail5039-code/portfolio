-- profiles.role 보호 트리거가 service_role 까지 막고 있던 문제를 고친다.
--
-- 무엇이 잘못됐나
--   20260817000002_rls.sql 의 protect_profile_role 은 is_admin() 이 아니면
--   role 변경을 되돌린다. 그런데 service_role 키로 접근하면 auth.uid() 가 없어서
--   is_admin() 이 언제나 false 다. 결과적으로 첫 관리자를 만들 방법이 없었다.
--
-- 왜 SECURITY DEFINER 를 뗐나
--   current_user 로 접근 주체를 봐야 하는데, SECURITY DEFINER 상태에서는
--   current_user 가 함수 소유자로 바뀐다. 이 함수는 NEW 만 손대고
--   테이블을 읽지 않으므로 호출자 권한으로 돌아도 문제가 없다.
--   (is_admin() 은 그대로 SECURITY DEFINER 다 — 그건 profiles 를 읽어야 한다)
--
-- 보호 범위는 그대로다. anon 과 authenticated 는 여전히 자기 role 을 못 바꾼다.
-- service_role 은 서버에서만 쓰는 키이고 이미 RLS 를 통째로 우회하므로
-- 여기서 막는 것이 보호에 보태는 것이 없다.

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user <> 'service_role'
     and not public.is_admin()
  then
    new.role := old.role;
  end if;
  return new;
end;
$$;
