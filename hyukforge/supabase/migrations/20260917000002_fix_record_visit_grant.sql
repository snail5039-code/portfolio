-- record_visit 이 anon 에게 열려 있었다.
--
-- 앞 마이그레이션(20260917000001)에서 `revoke ... from public` 만 하고
-- service_role 에 grant 했는데, 실제로 anon 키로 불러 보니 204 로 통과했다.
-- Supabase 는 public 스키마의 새 함수에 대해 anon·authenticated 에게
-- EXECUTE 를 기본 권한(alter default privileges)으로 따로 부여한다.
-- PUBLIC 에서 회수해도 그 직접 부여분은 남는다.
--
-- docs/ARCHITECTURE.md "함수 실행 권한 — 두 번 데인 곳" 에 적힌 함정이고,
-- record_download 도 20260817000004 에서 같은 이유로 한 번 더 고쳤다.
-- 이번이 세 번째다. 새 함수를 만들 때는 public·anon·authenticated 를
-- 모두 회수한 뒤 필요한 롤에만 다시 준다.
--
-- 이 함수가 anon 에게 열려 있으면 브라우저 콘솔에서 반복 호출해 홈의 방문자
-- 수를 올릴 수 있다. 부르는 쪽은 서버(/api/visit) 하나뿐이다.

revoke execute on function public.record_visit(boolean) from public;
revoke execute on function public.record_visit(boolean) from anon;
revoke execute on function public.record_visit(boolean) from authenticated;
grant  execute on function public.record_visit(boolean) to service_role;

-- 권한을 확인하느라 넣은 호출 두 건이 그대로 남았다. 사람이 온 것이 아니다.
-- (docs/DESIGN.md 7장 "숫자는 진짜만")
delete from public.site_visits
 where day = (now() at time zone 'Asia/Seoul')::date;
