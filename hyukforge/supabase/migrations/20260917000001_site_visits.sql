-- 사이트 방문자 수.
--
-- 홈 통계 네 칸 중 "가격 — 전부 무료" 자리를 대신한다. 무료라는 사실은
-- 히어로 설명과 고정 공지에 이미 있고, 그 칸만 값이 변하지 않았다.
-- (docs/DESIGN.md 1장 "실제 숫자 4개")
--
-- 날짜별로 쌓는다. 총합만 필요하지만 하루치가 남아 있어야 나중에
-- "언제부터 사람이 들어왔나"를 볼 수 있고, 잘못 센 날을 하루만 지울 수 있다.
--
-- 날짜 기준은 KST 다. 사이트의 다른 날짜(개발 기록·릴리스·공지)가 전부
-- 한국 시간이라 여기만 UTC 면 "오늘"의 경계가 어긋난다. (lib/format.ts)

create table public.site_visits (
  day      date   primary key,
  views    bigint not null default 0,
  visitors bigint not null default 0
);

comment on table  public.site_visits is '날짜별 사이트 방문. views 는 열어본 횟수, visitors 는 그날 처음 온 사람.';
comment on column public.site_visits.day is 'KST 기준 날짜.';

-- 정책을 하나도 만들지 않는다. 읽기는 아래 public_stats() 가 집계값만 내보내고,
-- 쓰기는 record_visit() 을 통해서만 한다. anon 이 직접 만지면 숫자를 부풀릴 수 있다.
alter table public.site_visits enable row level security;

-- ── 기록 ────────────────────────────────────────────────────────
-- 서버(/api/visit)만 부른다. anon 에 열어 주면 브라우저 콘솔에서 반복 호출해
-- 숫자를 올릴 수 있다. "숫자는 진짜만" 이 지켜지려면 여기가 막혀 있어야 한다.
-- (docs/DESIGN.md 7장)

create or replace function public.record_visit(new_visitor boolean)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.site_visits as v (day, views, visitors)
  values (
    (now() at time zone 'Asia/Seoul')::date,
    1,
    case when new_visitor then 1 else 0 end
  )
  on conflict (day) do update
    set views    = v.views + 1,
        visitors = v.visitors + case when new_visitor then 1 else 0 end;
$$;

revoke execute on function public.record_visit(boolean) from public;
grant  execute on function public.record_visit(boolean) to service_role;

-- ── 통계 ────────────────────────────────────────────────────────
-- 돌려주는 열이 하나 늘어서 replace 가 안 된다. 떨어뜨리고 다시 만든다.

drop function if exists public.public_stats();

create function public.public_stats()
returns table (
  product_count     int,
  monthly_downloads bigint,
  total_downloads   bigint,
  total_visitors    bigint,
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
    (select coalesce(sum(visitors), 0)
       from public.site_visits),
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

-- 함수는 만들자마자 EXECUTE 가 PUBLIC 에 붙는다. 명시적으로 정리한다.
-- (docs/ARCHITECTURE.md "함수 실행 권한")
revoke execute on function public.public_stats() from public;
grant  execute on function public.public_stats() to anon, authenticated;
