-- 0030: fixes the spelling of the collection web address  /collection/ocassional -> /collection/occasional
-- The old address keeps working: it redirects to the new one. Safe to run more than once.
-- Run this BEFORE uploading the new website files.

alter table public.collections add column if not exists old_slugs text[] not null default '{}';

update public.collections c
set slug = 'occasional',
    old_slugs = case when 'ocassional' = any (c.old_slugs) then c.old_slugs else array_append(c.old_slugs, 'ocassional') end
where c.slug = 'ocassional'
  and not exists (select 1 from public.collections x where x.slug = 'occasional');

-- Check: shows every collection with its name and address
select name, slug, old_slugs, active from public.collections order by name;
