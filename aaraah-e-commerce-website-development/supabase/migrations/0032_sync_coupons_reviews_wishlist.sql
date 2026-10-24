-- 0032: puts into the repo what already exists in the live Supabase database
-- (coupons, reviews, wishlist, courier/tracking columns, variant collection).
-- It was rebuilt from the live database on 2026-10-24. Everything is "if not exists" /
-- "create or replace", so running it on the live database changes nothing.
-- Its real use: rebuilding the database from scratch (new Supabase project).
-- NOTE: grants (who may call the functions) are not included — they were not exported.
--       Foreign keys / check rules below are the intended ones; the live ones were not exported.

-- 0013: each colour can have its own collection (NULL = same as the parent product) --------------
alter table public.product_variants
  add column if not exists collection_id uuid references public.collections (id) on delete set null;

-- Orders: courier / tracking / coupon columns ---------------------------------------------------
alter table public.orders add column if not exists courier_name text;
alter table public.orders add column if not exists tracking_number text;
alter table public.orders add column if not exists tracking_url text;
alter table public.orders add column if not exists shipped_at timestamptz;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_amount numeric not null default 0;

-- Coupons ---------------------------------------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric not null,
  max_discount numeric,
  min_order numeric not null default 0,
  usage_limit integer,
  per_user_limit integer not null default 1,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists coupons_code_upper_idx on public.coupons (upper(code));

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

-- Reviews ---------------------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  user_id uuid not null,
  reviewer_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  status text not null default 'published',
  created_at timestamptz not null default now()
);
-- submit_review() relies on this: one review per customer per product
create unique index if not exists reviews_product_user_idx on public.reviews (product_id, user_id);

-- Wishlist --------------------------------------------------------------------------------------
create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists wishlist_user_variant_idx on public.wishlist_items (user_id, variant_id);

-- Row level security (as it is live) ------------------------------------------------------------
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.reviews enable row level security;
alter table public.wishlist_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'coupons' and policyname = 'coupons_admin_all') then
    create policy coupons_admin_all on public.coupons for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'coupon_redemptions' and policyname = 'redemptions_admin_select') then
    create policy redemptions_admin_select on public.coupon_redemptions for select using (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_public_select') then
    create policy reviews_public_select on public.reviews for select using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'reviews' and policyname = 'reviews_admin_all') then
    create policy reviews_admin_all on public.reviews for all using (is_admin()) with check (is_admin());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wishlist_items' and policyname = 'wishlist_owner_select') then
    create policy wishlist_owner_select on public.wishlist_items for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wishlist_items' and policyname = 'wishlist_owner_insert') then
    create policy wishlist_owner_insert on public.wishlist_items for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename = 'wishlist_items' and policyname = 'wishlist_owner_delete') then
    create policy wishlist_owner_delete on public.wishlist_items for delete using (user_id = auth.uid());
  end if;
end $$;

-- Functions (exact copies of the live ones) -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_review(p_product_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select auth.uid() is not null and exists (
    select 1
    from public.orders o
    join public.order_items i on i.order_id = o.id
    join public.product_variants v on v.id = i.variant_id
    where o.user_id = auth.uid() and o.status = 'delivered' and v.product_id = p_product_id
  );
$function$;

CREATE OR REPLACE FUNCTION public.compute_coupon(p_code text, p_user uuid, p_subtotal numeric)
 RETURNS TABLE(coupon_id uuid, code text, discount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  c public.coupons%rowtype;
  v_used integer;
  v_used_by_user integer;
  v_disc numeric;
begin
  select * into c from public.coupons where upper(coupons.code) = upper(btrim(coalesce(p_code, ''))) and active;
  if not found then
    raise exception 'This coupon code is not valid';
  end if;
  if c.starts_at is not null and c.starts_at > now() then
    raise exception 'This coupon is not active yet';
  end if;
  if c.expires_at is not null and c.expires_at < now() then
    raise exception 'This coupon has expired';
  end if;
  if p_subtotal < c.min_order then
    raise exception 'Add items worth Rs. % or more to use this coupon', c.min_order::numeric(10, 0);
  end if;

  select count(*) into v_used
  from public.coupon_redemptions r join public.orders o on o.id = r.order_id
  where r.coupon_id = c.id and o.status <> 'cancelled';
  if c.usage_limit is not null and v_used >= c.usage_limit then
    raise exception 'This coupon has been fully used';
  end if;

  select count(*) into v_used_by_user
  from public.coupon_redemptions r join public.orders o on o.id = r.order_id
  where r.coupon_id = c.id and r.user_id = p_user and o.status <> 'cancelled';
  if v_used_by_user >= c.per_user_limit then
    raise exception 'You have already used this coupon';
  end if;

  if c.discount_type = 'percent' then
    v_disc := round(p_subtotal * c.discount_value / 100);
    if c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
  else
    v_disc := c.discount_value;
  end if;
  v_disc := greatest(0, least(v_disc, p_subtotal));

  return query select c.id, c.code, v_disc;
end;
$function$;

CREATE OR REPLACE FUNCTION public.preview_coupon(p_code text, p_subtotal numeric)
 RETURNS TABLE(code text, discount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;
  return query select c.code, c.discount from public.compute_coupon(p_code, auth.uid(), p_subtotal) c;
end;
$function$;

CREATE OR REPLACE FUNCTION public.submit_review(p_product_id uuid, p_rating integer, p_title text, p_body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_name text;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
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

  select split_part(btrim(full_name), ' ', 1)
         || case when split_part(btrim(full_name), ' ', 2) <> '' then ' ' || left(split_part(btrim(full_name), ' ', 2), 1) || '.' else '' end
    into v_name
  from public.orders where user_id = auth.uid() order by created_at desc limit 1;

  insert into public.reviews (product_id, user_id, reviewer_name, rating, title, body)
  values (p_product_id, auth.uid(), coalesce(nullif(v_name, ''), 'Customer'), p_rating, left(nullif(btrim(coalesce(p_title, '')), ''), 100), v_body)
  on conflict (product_id, user_id)
  do update set rating = excluded.rating, title = excluded.title, body = excluded.body
  returning id into v_id;
  return v_id;
end;
$function$;
