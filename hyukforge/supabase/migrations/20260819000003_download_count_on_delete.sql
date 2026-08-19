-- 탈퇴하면 다운로드 수가 부풀어 남던 문제.
--
-- record_download() 는 products.download_count 를 1 올린다. 그런데 계정을 지우면
-- downloads 행은 cascade 로 사라지는데 카운터는 그대로 남는다.
-- 탈퇴 화면이 없던 동안에는 기록을 지울 일이 없어 드러나지 않았다.
--
-- 카운터는 캐시값이고 정본은 downloads 다 (20260817000001 주석).
-- 캐시가 정본과 어긋나면 캐시가 틀린 것이다.
--
-- 지울 때만 다시 센다. 넣을 때는 record_download() 의 단일 UPDATE 를 그대로 둔다 —
-- 동시 요청에서도 값이 덮어써지지 않게 만들어둔 것이라 건드리지 않는다.
-- 지우는 일은 드물어서 다시 세도 부담이 없다.

create or replace function public.sync_download_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.products p
     set download_count = (
       -- record_download() 가 세는 기준과 같다 —
       -- 같은 릴리스를 여러 번 받아도 한 번으로 친다
       select count(distinct (d.user_id, d.release_id))
         from public.downloads d
        where d.product_id = old.product_id
     )
   where p.id = old.product_id;
  return null;
end;
$$;

create trigger downloads_sync_count_on_delete
  after delete on public.downloads
  for each row execute function public.sync_download_count();

-- 함수는 만들자마자 EXECUTE 가 PUBLIC 에 붙는다. 트리거가 부르는 것이라
-- 아무도 직접 호출할 필요가 없다. (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.sync_download_count() from public, anon, authenticated;
