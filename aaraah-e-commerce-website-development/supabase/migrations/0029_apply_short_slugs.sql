-- 0029: gives every EXISTING parent product its short web address.
-- The old address is kept in old_slugs, so old links (Google, WhatsApp, Instagram) redirect to the new one.
-- Run 0028 first. Parents whose short address would clash with another product are left unchanged.
-- Safe to run more than once.

with new_slugs as (
  select
    id,
    slug as old_slug,
    public.short_product_slug(name, parent_sku) as new_slug
  from public.products
  where parent_sku is not null and parent_sku <> ''
),
changes as (
  select n.*
  from new_slugs n
  where n.new_slug <> '' and n.new_slug <> n.old_slug
    and (select count(*) from new_slugs x where x.new_slug = n.new_slug) = 1
    and not exists (select 1 from public.products p where p.slug = n.new_slug and p.id <> n.id)
)
update public.products p
set slug = c.new_slug,
    old_slugs = case when c.old_slug = any (p.old_slugs) then p.old_slugs else array_append(p.old_slugs, c.old_slug) end
from changes c
where p.id = c.id;

-- Check: old address -> new address
select name, parent_sku, slug as new_slug, old_slugs from public.products order by name;
