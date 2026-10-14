alter table public.products
  add column implementation_status text not null default 'in_progress',
  add column deployment_status text not null default 'not_deployed',
  add constraint products_implementation_status_known
    check (implementation_status in ('implemented', 'in_progress')),
  add constraint products_deployment_status_known
    check (deployment_status in ('deployed', 'not_deployed', 'suspended'));

update public.products
set implementation_status = 'implemented',
    deployment_status = case
      when slug in ('commute-battle', 'lastcall') then 'deployed'
      when slug = 'je-trace' then 'suspended'
      else 'not_deployed'
    end;

