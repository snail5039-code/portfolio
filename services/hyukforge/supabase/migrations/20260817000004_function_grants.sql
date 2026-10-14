-- 함수 실행 권한을 제대로 잠근다.
--
-- 20260817000002_rls.sql 에서 record_download 를 anon 에게서 회수했지만 막히지 않았다.
-- Postgres 는 함수를 만들 때 EXECUTE 를 PUBLIC 에 자동으로 준다.
-- anon 은 PUBLIC 에 속하므로 anon 만 회수해봐야 소용이 없다. PUBLIC 부터 회수해야 한다.
--
-- 지금도 함수 안의 'authentication required' 검사가 막고는 있다.
-- 그건 이중 방어이고, 바깥쪽 권한이 먼저 잠겨 있어야 한다.

revoke execute on function public.record_download(uuid, uuid, text) from public;
revoke execute on function public.record_download(uuid, uuid, text) from anon;
grant  execute on function public.record_download(uuid, uuid, text) to authenticated;

-- is_admin 은 정책 안에서만 쓴다. 밖에서 부를 이유가 없다.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant  execute on function public.is_admin() to authenticated;

-- 트리거 전용 함수들. PostgREST 로 노출될 이유가 없다.
revoke execute on function public.touch_updated_at()      from public, anon, authenticated;
revoke execute on function public.protect_profile_role()  from public, anon, authenticated;
revoke execute on function public.handle_new_user()       from public, anon, authenticated;
