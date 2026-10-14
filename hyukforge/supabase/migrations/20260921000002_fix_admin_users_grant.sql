-- 회원 관리 함수의 anon 실행 권한을 걷어낸다.
--
-- 20260921000001 은 `revoke ... from public` 만 했다. 그것만으로는 모자라다 —
-- Supabase 는 public 스키마의 새 함수에 anon·authenticated 에게 EXECUTE 를
-- 기본 권한으로 **따로** 부여한다. PUBLIC 에서 회수해도 그 직접 부여분이 남는다.
-- record_visit 이 같은 이유로 뚫려 있었다 (20260917000002).
-- (docs/ARCHITECTURE.md "함수 실행 권한 — 세 번 데인 곳")
--
-- 실제로 무엇이 새고 있었나
--   admin_list_users 는 auth.users 의 이메일을 돌려준다. 함수 안의
--   is_admin() 검사 덕분에 anon 이 불러도 0행이라 값이 새지는 않았지만,
--   실행 자체가 막혀 있어야 한다. 검사 한 겹에 기대면 그 한 겹을 고칠 때
--   조용히 열린다. (db-check 가 이걸 잡았다)
--
-- set_role·clear_nickname 은 이미 401 이었다. 세 개를 같은 방식으로 맞춘다.

revoke execute on function public.admin_list_users()               from public, anon;
revoke execute on function public.admin_set_role(uuid, text)       from public, anon;
revoke execute on function public.admin_clear_nickname(uuid)       from public, anon;

grant  execute on function public.admin_list_users()               to authenticated;
grant  execute on function public.admin_set_role(uuid, text)       to authenticated;
grant  execute on function public.admin_clear_nickname(uuid)       to authenticated;
