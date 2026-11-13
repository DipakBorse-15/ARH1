-- 0041: (1) a review belongs to ONE colour (SKU), (2) rating numbers for the cards / "Top Rated" sort,
--       (3) Main Color names written in one spelling.
-- Safe to run more than once. Run it in Supabase -> SQL Editor BEFORE the site files are uploaded.

-- 1) reviews get a colour ---------------------------------------------------------------------------
alter table public.reviews
  add column if not exists variant_id uuid references public.product_variants (id) on delete set null;

-- Old reviews: if the customer received exactly ONE colour of that design, the review belongs to that colour.
-- Others stay on the whole design (variant_id empty) and still count for every colour of it.
update public.reviews r
set variant_id = x.variant_id
from (
  select r2.id as review_id, min(i.variant_id::text)::uuid as variant_id, count(distinct i.variant_id) as n
  from public.reviews r2
  join public.orders o on o.user_id = r2.user_id and o.status = 'delivered'
  join public.order_items i on i.order_id = o.id
  join public.product_variants v on v.id = i.variant_id and v.product_id = r2.product_id
  where r2.variant_id is null
  group by r2.id
) x
where r.id = x.review_id and x.n = 1;

-- One review per customer per COLOUR (it used to be one per design)
alter table public.reviews drop constraint if exists reviews_product_id_user_id_key;
drop index if exists public.reviews_product_user_idx;
create unique index if not exists reviews_user_product_variant_idx
  on public.reviews (user_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_reviews_variant on public.reviews (variant_id);

-- 2) colours this customer has received (used by the review form) -----------------------------------
create or replace function public.reviewable_variants(p_product_id uuid)
returns table (variant_id uuid, color text)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select distinct v.id, v.color
  from public.orders o
  join public.order_items i on i.order_id = o.id
  join public.product_variants v on v.id = i.variant_id
  where auth.uid() is not null
    and o.user_id = auth.uid()
    and o.status = 'delivered'
    and v.product_id = p_product_id;
$function$;
revoke all on function public.reviewable_variants(uuid) from public, anon;
grant execute on function public.reviewable_variants(uuid) to authenticated;

-- 3) submit_review now takes the colour --------------------------------------------------------------
drop function if exists public.submit_review(uuid, integer, text, text);

create or replace function public.submit_review(
  p_product_id uuid, p_rating integer, p_title text, p_body text, p_variant_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_name text;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
  v_variant uuid := p_variant_id;
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  if not public.can_review(p_product_id) then
    raise exception 'Only customers who have received this product can review it';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Choose a rating from 1 to 5';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1500 then
    raise exception 'Write a short review (up to 1500 characters)';
  end if;

  -- which colour is reviewed: it must be one the customer received
  if v_variant is null then
    select count(*), min(rv.variant_id::text)::uuid into v_n, v_variant from public.reviewable_variants(p_product_id) rv;
    if v_n <> 1 then
      raise exception 'Please choose which colour you are reviewing';
    end if;
  elsif not exists (select 1 from public.reviewable_variants(p_product_id) rv where rv.variant_id = v_variant) then
    raise exception 'You can only review a colour you have received';
  end if;

  select split_part(btrim(full_name), ' ', 1)
         || case when split_part(btrim(full_name), ' ', 2) <> '' then ' ' || left(split_part(btrim(full_name), ' ', 2), 1) || '.' else '' end
    into v_name
  from public.orders where user_id = auth.uid() order by created_at desc limit 1;

  -- same colour reviewed before -> update it; else an old whole-design review of mine -> turn it into this colour's review
  select id into v_id from public.reviews
   where user_id = auth.uid() and product_id = p_product_id and variant_id = v_variant;
  if v_id is null then
    select id into v_id from public.reviews
     where user_id = auth.uid() and product_id = p_product_id and variant_id is null
     limit 1;
  end if;

  if v_id is not null then
    update public.reviews
       set rating = p_rating,
           title = left(nullif(btrim(coalesce(p_title, '')), ''), 100),
           body = v_body,
           variant_id = v_variant
     where id = v_id;
  else
    insert into public.reviews (product_id, variant_id, user_id, reviewer_name, rating, title, body)
    values (p_product_id, v_variant, auth.uid(), coalesce(nullif(v_name, ''), 'Customer'), p_rating,
            left(nullif(btrim(coalesce(p_title, '')), ''), 100), v_body)
    returning id into v_id;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.submit_review(uuid, integer, text, text, uuid) from public, anon;
grant execute on function public.submit_review(uuid, integer, text, text, uuid) to authenticated;

-- 4) rating numbers for the product cards and the "Top Rated" sort ---------------------------------
-- One tiny row per reviewed colour (not the review texts). Replaces the version from 0040.
drop function if exists public.product_rating_summary();
create or replace function public.product_rating_summary()
returns table (product_id uuid, variant_id uuid, rating_sum integer, review_count integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.product_id, r.variant_id, sum(r.rating)::integer, count(*)::integer
  from public.reviews r
  where r.status = 'published'
  group by r.product_id, r.variant_id;
$function$;
grant execute on function public.product_rating_summary() to anon, authenticated;

-- 5) Main Color names in one spelling ("red" / "RED" -> "Red") --------------------------------------
update public.product_variants
set color_group = initcap(regexp_replace(btrim(color_group), '\s+', ' ', 'g'))
where color_group is not null and btrim(color_group) <> ''
  and color_group is distinct from initcap(regexp_replace(btrim(color_group), '\s+', ' ', 'g'));
update public.product_variants set color_group = null where color_group is not null and btrim(color_group) = '';
