-- =============================================================================
-- AARAAH.IN — 0023: collection order (which collection comes 1st, 2nd, 3rd, 4th)
-- Run once in Supabase SQL Editor. Safe to run more than once.
-- =============================================================================

alter table public.collections add column if not exists sort_order integer not null default 0;

-- Starting order = the order of the website menu. Others follow alphabetically.
with ranked as (
  select id,
         row_number() over (
           order by
             case slug
               when 'new-arrival' then 1
               when 'festive'     then 2
               when 'daily-wear'  then 3
               when 'occasional'  then 4
               else 5
             end,
             name
         ) as pos
  from public.collections
)
update public.collections c
set sort_order = r.pos
from ranked r
where c.id = r.id and c.sort_order = 0;

create index if not exists idx_collections_sort on public.collections (sort_order);
