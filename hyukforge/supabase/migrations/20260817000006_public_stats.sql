-- 홈 상단 통계.
--
-- 다운로드 수는 anon 이 직접 셀 수 없다. RLS 가 남의 기록을 막기 때문에
-- 비로그인 방문자가 세면 언제나 0 이 나온다.
-- 집계값만 돌려주는 함수를 두고 RLS 를 우회시킨다. 개인 데이터는 나가지 않는다.

create or replace function public.public_stats()
returns table (
  product_count     int,
  monthly_downloads bigint,
  total_downloads   bigint,
  last_updated      timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*)::int
       from public.products
      where status = 'published'),
    (select count(*)
       from public.downloads
      where created_at >= date_trunc('month', now())),
    (select coalesce(sum(download_count), 0)
       from public.products
      where status = 'published'),
    (select max(published_at)
       from public.products
      where status = 'published');
$$;

-- 함수는 만들자마자 EXECUTE 가 PUBLIC 에 붙는다. 명시적으로 정리한다.
-- (docs/ARCHITECTURE.md "함수 실행 권한" 참고)
revoke execute on function public.public_stats() from public;
grant  execute on function public.public_stats() to anon, authenticated;
