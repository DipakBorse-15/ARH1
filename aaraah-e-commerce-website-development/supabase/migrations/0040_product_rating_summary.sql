-- 0040: average rating per product, for the "Top Rated" sort on listing pages.
-- Returns ONE tiny row per product that has published reviews (not the reviews themselves),
-- so the storefront can sort by rating without downloading any review text.
create or replace function public.product_rating_summary()
returns table (product_id uuid, avg_rating numeric, review_count integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select r.product_id, round(avg(r.rating)::numeric, 2), count(*)::integer
  from public.reviews r
  where r.status = 'published'
  group by r.product_id;
$function$;

grant execute on function public.product_rating_summary() to anon, authenticated;
