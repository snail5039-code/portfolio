-- 홈의 "최근 업데이트"가 제품 발행일에 멈춰 있던 문제.
--
-- 원래는 products.published_at 의 최대값만 봤다. 그건 제품을 처음 낸 날이라
-- 새 버전을 올려도, 개발 기록을 써도 값이 그대로다. 실제로 v0.1.0 을 낸 08.10 에
-- 붙박여 있었다.
--
-- "최근 업데이트"는 사람이 보기에 "마지막으로 뭔가 한 날"이다.
-- 그래서 셋 중 가장 나중을 쓴다.
--   · 제품 발행일      — 릴리스가 없는 웹앱·소스 제품도 있으므로 남긴다
--   · 릴리스 배포일    — 새 버전을 내면 여기가 움직인다
--   · 개발 기록 날짜   — 코드를 고쳤지만 배포는 안 한 날도 잡힌다
--
-- greatest() 는 NULL 을 무시하고 나머지 중 최대를 준다. 셋 다 비면 NULL 이고,
-- 화면은 그때 "—" 를 보여준다.

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
    greatest(
      (select max(published_at)
         from public.products
        where status = 'published'),
      (select max(r.released_at)
         from public.releases r
         join public.products p on p.id = r.product_id
        where p.status = 'published'),
      (select max(c.entry_date)::timestamptz
         from public.changelog_entries c)
    );
$$;

-- create or replace 는 권한을 유지하지만, PUBLIC 에 EXECUTE 가 다시 붙는지는
-- 버전에 따라 다르다. 원래 파일과 같은 순서로 다시 정리한다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.public_stats() from public;
grant  execute on function public.public_stats() to anon, authenticated;
