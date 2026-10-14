-- 스크린샷을 올릴 자리.
--
-- 설치파일과 다르다. 설치파일은 200MB 라 GitHub Releases 에 두고 주소만 저장하지만
-- (docs/ARCHITECTURE.md 1장), 스크린샷은 한 장에 수백 KB 라 여기 둬도 된다.
-- GitHub 에 두면 제품마다 저장소가 있어야 하고, 웹앱처럼 저장소가 없는 제품은
-- 올릴 데가 없어진다.
--
-- 공개 버킷이다. 스크린샷은 제품 화면에 그대로 걸리는 것이라 감출 이유가 없고,
-- 서명 URL 을 쓰면 만료될 때마다 다시 발급해야 해서 정적 페이지에 담을 수 없다.
-- 대신 쓰기는 관리자만 한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  true,
  -- 5MB. 스크린샷 한 장에 이보다 크면 줄여서 올리는 게 맞다.
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ── 접근 제어 ────────────────────────────────────────────────────
-- storage.objects 는 RLS 가 켜진 채로 온다. 정책을 안 만들면 아무도 못 쓴다.
-- 버킷이 public 이어도 그건 공개 URL 로 읽는 경로에만 해당한다.

create policy "제품 이미지는 공개"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-media');

create policy "제품 이미지 올리기는 관리자만"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "제품 이미지 바꾸기는 관리자만"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-media' and public.is_admin())
  with check (bucket_id = 'product-media' and public.is_admin());

create policy "제품 이미지 지우기는 관리자만"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-media' and public.is_admin());
