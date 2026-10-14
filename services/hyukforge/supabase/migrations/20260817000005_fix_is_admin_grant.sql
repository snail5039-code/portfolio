-- is_admin() 실행 권한을 anon 에게 되돌린다.
--
-- 20260817000004 에서 "밖에서 부를 이유가 없다"며 anon 에게서 회수했는데,
-- 그게 공개 제품 조회를 통째로 막았다.
--
-- 정책이 이렇게 생겼기 때문이다:
--   using (status = 'published' or public.is_admin())
--
-- 이 정책은 to anon, authenticated 라서 anon 이 조회할 때도 평가된다.
-- SQL 의 or 는 왼쪽이 참이라고 오른쪽을 건너뛴다는 보장이 없어서,
-- anon 에게 실행 권한이 없으면 발행된 제품을 읽을 때조차 permission denied 가 난다.
--
-- 되돌려도 새는 정보는 없다. 로그인하지 않으면 auth.uid() 가 null 이라
-- is_admin() 은 anon 에게 언제나 false 다.
--
-- 대안은 정책을 역할별로 쪼개는 것이다 (anon 용은 status='published' 만 보고,
-- authenticated 용만 is_admin() 을 부르는 식). 정책 8개를 고쳐야 하는데,
-- is_admin() 은 stable 이라 Postgres 가 문장 단위로 캐시하므로 이득이 크지 않다.

grant execute on function public.is_admin() to anon;
