-- 들어온 요청을 사람과 봇으로 갈라 날짜별로 센다.
--
-- 왜 site_visits 로는 모자란가
--   site_visits 는 홈에 걸리는 "방문자" 한 줄을 위한 것이다. 브라우저가
--   /api/visit 를 불러야 세어지고, 봇은 자바스크립트를 돌리지 않으니 애초에
--   그 요청을 보내지 않는다. 그래서 그 표에는 봇이 한 번도 나타나지 않는다.
--   "오늘 30명 왔다"가 사람 30명인지 크롤러 28대인지 구분할 수가 없었다.
--
--   여기는 프록시(proxy.ts)가 페이지 요청마다 직접 남긴다. 봇도 걸린다.
--
-- 두 숫자는 뜻이 다르다. 합치지 않는다.
--   site_visits.visitors — 그날 처음 온 사람 (쿠키 기준, 홈에 표시)
--   site_hits.hits       — 서버가 받은 페이지 요청 수 (사람·봇 각각)
--
-- 개인을 식별하는 값은 넣지 않는다. IP 도 UA 원문도 남기지 않고,
-- 이름표(googlebot, chrome 같은 것) 하나로 줄여서 날짜별 합계만 쌓는다.
-- (docs/DESIGN.md 7장 "숫자는 진짜만")

create table public.site_hits (
  day    date    not null,
  is_bot boolean not null,
  agent  text    not null,
  hits   bigint  not null default 0,
  primary key (day, is_bot, agent)
);

comment on table  public.site_hits is '날짜별 페이지 요청 수. 사람과 봇을 갈라 센다.';
comment on column public.site_hits.agent is '이름표 하나로 줄인 UA (googlebot·chrome 등). 원문은 남기지 않는다.';
comment on column public.site_hits.day is 'KST 기준 날짜. 사이트의 다른 날짜와 기준을 맞춘다.';

create index site_hits_recent_idx on public.site_hits (day desc);

-- ── 기록 ────────────────────────────────────────────────────────
-- 프록시(서버)만 부른다. anon 에 열어 주면 브라우저에서 반복 호출해
-- 통계를 부풀릴 수 있다. record_visit 과 같은 규칙이다.

create or replace function public.record_hit(p_is_bot boolean, p_agent text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.site_hits as h (day, is_bot, agent, hits)
  values (
    (now() at time zone 'Asia/Seoul')::date,
    coalesce(p_is_bot, false),
    -- 부르는 쪽이 이미 줄여서 보내지만, 여기서도 자른다. 이름표가 길어지면
    -- 그건 UA 원문이 새어 들어온 것이고 그대로 쌓이면 표가 못 쓰게 된다.
    nullif(left(coalesce(p_agent, ''), 40), ''),
    1
  )
  on conflict (day, is_bot, agent) do update
    set hits = h.hits + 1;
$$;

-- 새 함수는 public·anon·authenticated 를 모두 회수한 뒤 필요한 롤에만 준다.
-- 세 번 데인 곳이다 (docs/ARCHITECTURE.md "함수 실행 권한").
revoke execute on function public.record_hit(boolean, text) from public;
revoke execute on function public.record_hit(boolean, text) from anon;
revoke execute on function public.record_hit(boolean, text) from authenticated;
grant  execute on function public.record_hit(boolean, text) to service_role;

-- ── 접근 제어 ───────────────────────────────────────────────────
-- 읽는 사람은 관리자 화면(/admin/visits) 하나뿐이다. anon 에게는 0행.

alter table public.site_hits enable row level security;

create policy "방문 기록은 관리자만" on public.site_hits
  for select to authenticated
  using (public.is_admin());

-- site_visits 는 정책을 하나도 만들지 않았다(20260917000001). 집계는
-- public_stats() 로만 나갔으니 그걸로 충분했는데, 이제 관리자 화면이
-- 날짜별 원본을 읽어야 한다. 읽기만 연다 — 쓰기는 여전히 record_visit() 뿐이다.
create policy "방문자 수는 관리자만" on public.site_visits
  for select to authenticated
  using (public.is_admin());
