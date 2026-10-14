-- GitHub 자동 동기화 기준점.
-- 공개 화면에서 읽을 값이 아니며 service_role로 실행하는 GitHub Actions만 사용한다.
create table public.github_sync_state (
  product_id      uuid primary key references public.products(id) on delete cascade,
  repository      text not null,
  last_commit_sha text not null,
  last_release_id bigint,
  synced_at       timestamptz not null default now()
);

alter table public.github_sync_state enable row level security;

revoke all on table public.github_sync_state from public, anon, authenticated;
grant select, insert, update, delete on table public.github_sync_state to service_role;

