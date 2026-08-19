-- 접근 제어
-- 설계 근거: docs/ARCHITECTURE.md 3.3
--
-- 요약
--  · 발행된 제품과 그에 딸린 것들은 누구나 읽는다. 나머지 쓰기는 관리자만.
--  · 프로필·다운로드 기록·이용권은 본인 것만 보인다.
--  · 다운로드 기록은 record_download() 로만 남긴다. 직접 insert는 막는다.

-- ── 관리자 판정 ─────────────────────────────────────────────────
-- JWT가 아니라 profiles.role을 본다. 권한을 바꾸면 다시 로그인하지 않아도 즉시 반영된다.
-- 정책 안에서 profiles를 읽어야 하므로 security definer로 RLS를 우회한다.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- 사용자가 스스로를 관리자로 올리지 못하게 한다.
-- 컬럼 단위 제어는 정책으로 표현하기 어려워 트리거로 되돌린다.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ── 다운로드 기록 ───────────────────────────────────────────────
-- 기록 남기기와 카운터 증가를 한 트랜잭션으로 묶는다.
-- 같은 릴리스를 여러 번 받으면 기록은 매번 남기되 카운터는 최초 1회만 올린다.

create or replace function public.record_download(
  p_product_id uuid,
  p_release_id uuid,
  p_locale     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_first boolean;
begin
  if v_user is null then
    raise exception 'authentication required';
  end if;

  -- 발행되지 않은 제품은 받을 수 없다
  if not exists (
    select 1 from public.products
    where id = p_product_id and status = 'published'
  ) then
    raise exception 'product not available';
  end if;

  select not exists (
    select 1 from public.downloads
    where user_id = v_user and release_id = p_release_id
  ) into v_first;

  insert into public.downloads (user_id, product_id, release_id, locale)
  values (v_user, p_product_id, p_release_id, p_locale);

  if v_first then
    -- 단일 UPDATE라 동시 요청에서도 값이 덮어써지지 않는다
    update public.products
       set download_count = download_count + 1
     where id = p_product_id;
  end if;
end;
$$;

revoke execute on function public.record_download(uuid, uuid, text) from anon;

-- ── RLS 켜기 ────────────────────────────────────────────────────

alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.product_translations   enable row level security;
alter table public.product_images         enable row level security;
alter table public.releases               enable row level security;
alter table public.release_notes          enable row level security;
alter table public.changelog_entries      enable row level security;
alter table public.changelog_translations enable row level security;
alter table public.profiles               enable row level security;
alter table public.downloads              enable row level security;
alter table public.entitlements           enable row level security;

-- ── 공개 콘텐츠 ─────────────────────────────────────────────────

create policy "분류는 공개" on public.categories
  for select to anon, authenticated using (true);

create policy "분류 수정은 관리자만" on public.categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "발행된 제품은 공개" on public.products
  for select to anon, authenticated
  using (status = 'published' or public.is_admin());

create policy "제품 수정은 관리자만" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 제품에 딸린 것들은 부모 제품의 공개 여부를 따라간다
create policy "발행된 제품의 번역은 공개" on public.product_translations
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "번역 수정은 관리자만" on public.product_translations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "발행된 제품의 이미지는 공개" on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "이미지 수정은 관리자만" on public.product_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "발행된 제품의 릴리스는 공개" on public.releases
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.status = 'published' or public.is_admin())
  ));

create policy "릴리스 수정은 관리자만" on public.releases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "릴리스 노트는 공개" on public.release_notes
  for select to anon, authenticated
  using (exists (
    select 1 from public.releases r
    join public.products p on p.id = r.product_id
    where r.id = release_id and (p.status = 'published' or public.is_admin())
  ));

create policy "릴리스 노트 수정은 관리자만" on public.release_notes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "개발 기록은 공개" on public.changelog_entries
  for select to anon, authenticated using (true);

create policy "개발 기록 수정은 관리자만" on public.changelog_entries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "개발 기록 번역은 공개" on public.changelog_translations
  for select to anon, authenticated using (true);

create policy "개발 기록 번역 수정은 관리자만" on public.changelog_translations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── 개인 데이터 ─────────────────────────────────────────────────

create policy "프로필은 본인만" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy "프로필 수정은 본인만" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- role 컬럼은 profiles_protect_role 트리거가 되돌린다

create policy "다운로드 기록은 본인만" on public.downloads
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());
-- insert 정책을 두지 않는다. record_download() 만이 유일한 경로다.

create policy "이용권은 본인만" on public.entitlements
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy "이용권 발급은 관리자만" on public.entitlements
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
