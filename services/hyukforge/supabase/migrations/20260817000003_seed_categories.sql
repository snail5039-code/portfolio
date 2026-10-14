-- 분류 5개.
-- 이름은 여기 없다. messages/*.json의 category.<slug>를 화면에서 찾아 쓴다.
-- sort_order는 목록 필터에 나오는 순서다.

insert into public.categories (slug, sort_order) values
  ('office',    10),
  ('games',     20),
  ('utilities', 30),
  ('webapps',   40),
  ('labs',      50)
on conflict (slug) do update set sort_order = excluded.sort_order;
