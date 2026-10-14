-- 어디를 거쳐 들어왔는지.
--
-- 왜 필요한가
--   site_visits 는 "몇 명 왔나"까지만 말한다. 사람이 늘어도 그게 검색에
--   잡히기 시작한 것인지, 내가 노션에 걸어 둔 링크가 도는 것인지 알 수 없었다.
--   둘은 다음에 할 일이 다르다 — 앞이면 글을 더 쓰고, 뒤면 링크를 더 뿌린다.
--
-- 남기는 것
--   도메인을 이름표로 줄인 값(google·notion·github)과, 검색엔진이 넘겨준
--   검색어. 경로(path)는 버린다. 어느 글에서 왔는지까지 쌓으면 링크 하나로
--   사람을 좁힐 수 있게 된다. IP 도 UA 원문도 여전히 저장하지 않는다.
--   (lib/referrers.ts · docs/DESIGN.md 7장 "숫자는 진짜만")
--
-- 사람만 센다. 봇의 Referer 는 자기가 적어 넣은 값이라 뜻이 없다.

create table public.site_referrers (
  day    date   not null,
  -- search · ai · mine · social · link · direct (lib/referrers.ts)
  kind   text   not null,
  source text   not null,
  -- 검색어. 넘겨주지 않는 곳이 더 많아서 빈 문자열이 기본이다.
  -- null 로 두면 기본키가 안 먹는다 — null 은 서로 같지 않아 같은 줄이 계속 새로 생긴다.
  term   text   not null default '',
  hits   bigint not null default 0,
  primary key (day, kind, source, term)
);

comment on table  public.site_referrers is '날짜별 유입 경로. 사람 요청만 센다.';
comment on column public.site_referrers.kind   is '갈래 — search·ai·mine·social·link·direct.';
comment on column public.site_referrers.source is '도메인을 줄인 이름표. 원래 주소는 남기지 않는다.';
comment on column public.site_referrers.term   is '검색엔진이 넘겨준 검색어. 없으면 빈 문자열.';
comment on column public.site_referrers.day    is 'KST 기준 날짜. 사이트의 다른 날짜와 기준을 맞춘다.';

create index site_referrers_recent_idx on public.site_referrers (day desc);

alter table public.site_referrers enable row level security;

-- 읽는 사람은 관리자 화면(/admin/visits) 하나뿐이다. anon 은 0행을 본다.
create policy "유입 경로는 관리자만" on public.site_referrers
  for select to authenticated
  using (public.is_admin());

-- ── 기록 ────────────────────────────────────────────────────────
-- 요청 한 건이 두 줄을 남긴다 — 사람/봇 집계와 유입 경로. 같은 요청 하나를
-- 두 각도에서 적는 것이라 함수도 하나로 둔다. 나눠 두면 프록시가 요청마다
-- Supabase 를 두 번 부르게 된다.
--
-- 인자가 늘어서 replace 가 안 된다. 옛 시그니처를 떨어뜨리고 다시 만든다.
-- 남겨 두면 PostgREST 가 둘 중 어느 것을 부를지 인자 이름으로 고르게 되는데,
-- 그 규칙을 나중에 기억하고 있을 자신이 없다.

drop function if exists public.record_hit(boolean, text);

create function public.record_hit(
  p_is_bot boolean,
  p_agent  text,
  p_kind   text default null,
  p_source text default null,
  p_term   text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
begin
  insert into public.site_hits as h (day, is_bot, agent, hits)
  values (
    d,
    coalesce(p_is_bot, false),
    -- 부르는 쪽이 이미 줄여서 보내지만, 여기서도 자른다. 이름표가 길어지면
    -- 그건 UA 원문이 새어 들어온 것이고 그대로 쌓이면 표가 못 쓰게 된다.
    nullif(left(coalesce(p_agent, ''), 40), ''),
    1
  )
  on conflict (day, is_bot, agent) do update
    set hits = h.hits + 1;

  -- 유입은 사람일 때만, 그리고 갈래가 정해졌을 때만 센다.
  -- 사이트 안에서 옮겨 다닌 요청은 부르는 쪽이 아예 null 로 보낸다.
  if coalesce(p_is_bot, false) or p_kind is null then
    return;
  end if;

  insert into public.site_referrers as r (day, kind, source, term, hits)
  values (
    d,
    left(p_kind, 20),
    -- 이름표가 비어 오는 일은 없어야 하지만, 비면 예외가 나면서 위의 사람/봇
    -- 집계까지 같이 굴러떨어진다(한 트랜잭션이다). 빈 값은 '기타'로 받는다.
    coalesce(nullif(left(coalesce(p_source, ''), 40), ''), '기타'),
    left(coalesce(p_term, ''), 60),
    1
  )
  on conflict (day, kind, source, term) do update
    set hits = r.hits + 1;
end;
$$;

-- 새 함수는 public·anon·authenticated 를 모두 회수한 뒤 필요한 롤에만 준다.
-- 네 번 데인 곳이다 (docs/ARCHITECTURE.md "함수 실행 권한").
revoke execute on function public.record_hit(boolean, text, text, text, text) from public;
revoke execute on function public.record_hit(boolean, text, text, text, text) from anon;
revoke execute on function public.record_hit(boolean, text, text, text, text) from authenticated;
grant  execute on function public.record_hit(boolean, text, text, text, text) to service_role;

-- ── 홈 통계 ─────────────────────────────────────────────────────
-- 홈 네 칸의 "방문자" 가 그동안 총합이었다. 몇 달치가 쌓인 수는 어제와
-- 오늘이 같아 보여서, 보고 나서 알게 되는 것이 없었다. 오늘 값으로 바꾼다.
--
-- 총합도 계속 돌려준다 — 값을 지우는 마이그레이션은 되돌리기가 번거롭고,
-- 이 함수는 anon 이 부르는 공개 창구라 한 번 더 바꿀 일을 만들지 않는 편이 낫다.
--
-- 돌려주는 열이 늘어서 replace 가 안 된다. 떨어뜨리고 다시 만든다.

drop function if exists public.public_stats();

create function public.public_stats()
returns table (
  product_count     int,
  monthly_downloads bigint,
  total_downloads   bigint,
  total_visitors    bigint,
  today_visitors    bigint,
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
    -- 오늘 아직 아무도 안 왔으면 행 자체가 없다. 그때는 0 이다.
    (select coalesce(
       (select visitors
          from public.site_visits
         where day = (now() at time zone 'Asia/Seoul')::date),
       0)),
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

revoke execute on function public.public_stats() from public;
grant  execute on function public.public_stats() to anon, authenticated;
