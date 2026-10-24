-- 0028: short product web addresses + redirects from old addresses.
-- Safe to run more than once. Run this BEFORE uploading the new website files.

alter table public.products add column if not exists old_slugs text[] not null default '{}';
create index if not exists products_old_slugs_idx on public.products using gin (old_slugs);

-- Same rules as shortSlug() in api/_lib/seoText.js:
-- removes "AARAAH", "Women's" and the "with unstitched blouse piece" tail, keeps the keywords
-- (max 70 characters) and ends with the parent SKU (without a trailing -P).
create or replace function public.short_product_slug(p_name text, p_parent_sku text)
returns text
language plpgsql
immutable
as $$
declare
  s text;
  base text;
  sku text;
begin
  s := lower(coalesce(p_name, ''));
  s := replace(replace(s, '’', ''''), '`', '''');
  s := regexp_replace(s, '\maaraah\M', ' ', 'g');
  s := regexp_replace(s, '\mwomen''?s\M', ' ', 'g');
  s := regexp_replace(s, '\mwith\s+(an\s+)?(unstitched\s+)?blouse(\s+piec\w*)?', ' ', 'g');
  s := regexp_replace(s, '\munstitched\s+blouse(\s+piec\w*)?', ' ', 'g');
  base := trim(both '-' from regexp_replace(trim(regexp_replace(s, '[^a-z0-9]+', ' ', 'g')), '\s+', '-', 'g'));
  if length(base) > 70 then
    base := left(base, 70);
    base := regexp_replace(base, '-[^-]*$', '');
  end if;
  sku := lower(coalesce(p_parent_sku, ''));
  sku := regexp_replace(sku, '-p$', '');
  sku := trim(both '-' from regexp_replace(sku, '[^a-z0-9]+', '-', 'g'));
  return concat_ws('-', nullif(base, ''), nullif(sku, ''));
end;
$$;
