-- =====================================================================================================
-- AARAAH: LIVE DATABASE SNAPSHOT (read from the live Supabase project on 8 Nov 2026)
--
-- REFERENCE ONLY. DO NOT RUN THIS ON THE LIVE DATABASE (it is already there).
-- Purpose: if the Supabase project is ever lost or a new one is needed, this file + supabase/migrations/
-- show exactly what the live database looks like, so it can be rebuilt (run it on a NEW empty project,
-- then restore the data from the weekly backup mail).
--
-- What is NOT in here: the cron job commands (only their names + schedules are listed at the bottom),
-- Edge Function secrets, Auth settings (SMTP, redirect URLs), Storage files, and the data itself.
-- =====================================================================================================

create extension if not exists pgcrypto;
create sequence if not exists public.order_number_seq;


-- ---------------------------------------------------------------- TABLES
create table if not exists public.addresses (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  full_name text not null,
  mobile text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean default false not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.cart_items (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  variant_id uuid not null,
  quantity integer default 1 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.categories (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  description text,
  image text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  seo_title text,
  seo_description text
);
create table if not exists public.category_collections (
  id uuid default gen_random_uuid() not null,
  category_id uuid not null,
  collection_id uuid not null,
  image text,
  mobile_image text,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.collections (
  id uuid default gen_random_uuid() not null,
  name text not null,
  slug text not null,
  description text,
  image text,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  mobile_image text,
  sort_order integer default 0 not null,
  seo_title text,
  seo_description text,
  old_slugs text[] default '{}'::text[] not null
);
create table if not exists public.coupon_redemptions (
  id uuid default gen_random_uuid() not null,
  coupon_id uuid not null,
  order_id uuid not null,
  user_id uuid not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.coupons (
  id uuid default gen_random_uuid() not null,
  code text not null,
  description text,
  discount_type text not null,
  discount_value numeric not null,
  max_discount numeric,
  min_order numeric default 0 not null,
  usage_limit integer,
  per_user_limit integer default 1 not null,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.hero_slides (
  id uuid default gen_random_uuid() not null,
  title text not null,
  subtitle text,
  image text not null,
  cta_text text,
  cta_link text,
  active boolean default true not null,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  category_id uuid,
  mobile_image text
);
create table if not exists public.order_items (
  id uuid default gen_random_uuid() not null,
  order_id uuid not null,
  variant_id uuid,
  product_name text not null,
  brand text default 'AARAAH'::text not null,
  color text,
  sku text not null,
  quantity integer not null,
  unit_price numeric not null,
  line_total numeric not null,
  image_url text
);
create table if not exists public.orders (
  id uuid default gen_random_uuid() not null,
  order_number text not null,
  user_id uuid not null,
  full_name text not null,
  mobile text not null,
  email text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  payment_method text default 'cod'::text not null,
  payment_status text default 'pending'::text not null,
  status text default 'pending'::text not null,
  subtotal numeric default 0 not null,
  shipping_fee numeric default 0 not null,
  total numeric default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  payment_reference text,
  payment_reference_at timestamp with time zone,
  courier_name text,
  tracking_number text,
  tracking_url text,
  shipped_at timestamp with time zone,
  coupon_code text,
  discount_amount numeric default 0 not null,
  cancel_reason text,
  cancel_email_sent_at timestamp with time zone
);
create table if not exists public.product_images (
  id uuid default gen_random_uuid() not null,
  variant_id uuid not null,
  storage_path text not null,
  url text not null,
  alt_text text,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  thumb_url text,
  thumb_path text
);
create table if not exists public.product_variants (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  sku text not null,
  color text,
  color_hex text,
  attributes jsonb default '{}'::jsonb not null,
  price numeric not null,
  sale_price numeric,
  stock_quantity integer default 0 not null,
  is_available boolean default true not null,
  active boolean default true not null,
  variant_info text,
  sort_order integer default 0 not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  bullet_points text[] default '{}'::text[] not null,
  description text,
  work_type text,
  work_pattern text,
  best_for text,
  manufacturer text,
  included_components text,
  discount_percent numeric,
  discount_amount numeric,
  color_group text,
  fabric_type text,
  search_keywords text,
  collection_id uuid
);
create table if not exists public.products (
  id uuid default gen_random_uuid() not null,
  brand text default 'AARAAH'::text not null,
  name text not null,
  slug text not null,
  description text,
  bullet_points text[] default '{}'::text[] not null,
  category_id uuid,
  collection_id uuid,
  active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  parent_sku text,
  seo_title text,
  seo_description text,
  old_slugs text[] default '{}'::text[] not null
);
create table if not exists public.profiles (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  full_name text,
  email text,
  mobile text,
  role text default 'customer'::text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table if not exists public.reviews (
  id uuid default gen_random_uuid() not null,
  product_id uuid not null,
  user_id uuid not null,
  reviewer_name text not null,
  rating integer not null,
  title text,
  body text not null,
  status text default 'published'::text not null,
  created_at timestamp with time zone default now() not null
);
create table if not exists public.site_settings (
  id boolean default true not null,
  logo_url text,
  site_name text default 'AARAAH'::text not null,
  tagline text,
  announcement_text text,
  announcement_link text,
  announcement_active boolean default false not null,
  updated_at timestamp with time zone default now() not null,
  font_family text default 'Inter'::text not null,
  announcement2_text text,
  announcement2_link text,
  announcement2_active boolean default false not null,
  hero_slide_seconds integer default 5 not null,
  stats_reset_at timestamp with time zone
);
create table if not exists public.wishlist_items (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  variant_id uuid not null,
  created_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------- CONSTRAINTS
alter table public.addresses add constraint addresses_pkey PRIMARY KEY (id);
alter table public.cart_items add constraint cart_items_pkey PRIMARY KEY (id);
alter table public.cart_items add constraint cart_items_user_id_variant_id_key UNIQUE (user_id, variant_id);
alter table public.categories add constraint categories_pkey PRIMARY KEY (id);
alter table public.categories add constraint categories_slug_key UNIQUE (slug);
alter table public.category_collections add constraint category_collections_category_id_collection_id_key UNIQUE (category_id, collection_id);
alter table public.category_collections add constraint category_collections_pkey PRIMARY KEY (id);
alter table public.collections add constraint collections_pkey PRIMARY KEY (id);
alter table public.collections add constraint collections_slug_key UNIQUE (slug);
alter table public.coupon_redemptions add constraint coupon_redemptions_order_id_key UNIQUE (order_id);
alter table public.coupon_redemptions add constraint coupon_redemptions_pkey PRIMARY KEY (id);
alter table public.coupons add constraint coupons_pkey PRIMARY KEY (id);
alter table public.hero_slides add constraint hero_slides_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_order_number_key UNIQUE (order_number);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.product_images add constraint product_images_pkey PRIMARY KEY (id);
alter table public.product_variants add constraint product_variants_pkey PRIMARY KEY (id);
alter table public.product_variants add constraint product_variants_sku_key UNIQUE (sku);
alter table public.products add constraint products_pkey PRIMARY KEY (id);
alter table public.products add constraint products_slug_key UNIQUE (slug);
alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
alter table public.profiles add constraint profiles_user_id_key UNIQUE (user_id);
alter table public.reviews add constraint reviews_pkey PRIMARY KEY (id);
alter table public.reviews add constraint reviews_product_id_user_id_key UNIQUE (product_id, user_id);
alter table public.site_settings add constraint site_settings_pkey PRIMARY KEY (id);
alter table public.wishlist_items add constraint wishlist_items_pkey PRIMARY KEY (id);
alter table public.wishlist_items add constraint wishlist_items_user_id_variant_id_key UNIQUE (user_id, variant_id);
alter table public.cart_items add constraint cart_items_quantity_check CHECK ((quantity > 0));
alter table public.coupons add constraint coupons_discount_type_check CHECK ((discount_type = ANY (ARRAY['percent'::text, 'flat'::text])));
alter table public.coupons add constraint coupons_discount_value_check CHECK ((discount_value > (0)::numeric));
alter table public.order_items add constraint order_items_quantity_check CHECK ((quantity > 0));
alter table public.orders add constraint orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])));
alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text])));
alter table public.product_variants add constraint product_variants_price_check CHECK ((price >= (0)::numeric));
alter table public.product_variants add constraint product_variants_price_positive CHECK (((price > (0)::numeric) AND ((sale_price IS NULL) OR (sale_price > (0)::numeric))));
alter table public.product_variants add constraint product_variants_sale_le_price CHECK (((sale_price IS NULL) OR (sale_price <= price)));
alter table public.product_variants add constraint product_variants_sale_price_check CHECK (((sale_price IS NULL) OR (sale_price >= (0)::numeric)));
alter table public.product_variants add constraint product_variants_stock_quantity_check CHECK ((stock_quantity >= 0));
alter table public.profiles add constraint profiles_role_check CHECK ((role = ANY (ARRAY['customer'::text, 'admin'::text])));
alter table public.reviews add constraint reviews_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 1500)));
alter table public.reviews add constraint reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)));
alter table public.reviews add constraint reviews_status_check CHECK ((status = ANY (ARRAY['published'::text, 'hidden'::text])));
alter table public.site_settings add constraint site_settings_hero_slide_seconds_check CHECK (((hero_slide_seconds >= 2) AND (hero_slide_seconds <= 60)));
alter table public.site_settings add constraint site_settings_singleton CHECK (id);
alter table public.addresses add constraint addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cart_items add constraint cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.cart_items add constraint cart_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;
alter table public.category_collections add constraint category_collections_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
alter table public.category_collections add constraint category_collections_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE;
alter table public.coupon_redemptions add constraint coupon_redemptions_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE;
alter table public.coupon_redemptions add constraint coupon_redemptions_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.coupon_redemptions add constraint coupon_redemptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.hero_slides add constraint hero_slides_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.order_items add constraint order_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL;
alter table public.orders add constraint orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
alter table public.product_images add constraint product_images_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;
alter table public.product_variants add constraint product_variants_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;
alter table public.product_variants add constraint product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.products add constraint products_category_id_fkey FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;
alter table public.products add constraint products_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE SET NULL;
alter table public.profiles add constraint profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;
alter table public.reviews add constraint reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wishlist_items add constraint wishlist_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.wishlist_items add constraint wishlist_items_variant_id_fkey FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------- INDEXES (those not created by a constraint)
CREATE INDEX IF NOT EXISTS idx_addresses_user ON public.addresses USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_cart_user ON public.cart_items USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON public.categories USING btree (active);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_category_collections_cat ON public.category_collections USING btree (category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_collections_active ON public.collections USING btree (active);
CREATE INDEX IF NOT EXISTS idx_collections_slug ON public.collections USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_collections_sort ON public.collections USING btree (sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons USING btree (upper(code));
CREATE INDEX IF NOT EXISTS idx_hero_slides_active ON public.hero_slides USING btree (active, sort_order);
CREATE INDEX IF NOT EXISTS idx_hero_slides_category ON public.hero_slides USING btree (category_id, active, sort_order);
CREATE INDEX IF NOT EXISTS idx_images_variant ON public.product_images USING btree (variant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders USING btree (status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products USING btree (active);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products USING btree (category_id);
CREATE INDEX IF NOT EXISTS idx_products_collection ON public.products USING btree (collection_id);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products USING btree (created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_parent_sku ON public.products USING btree (parent_sku) WHERE (parent_sku IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products USING btree (slug);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles USING btree (role);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews USING btree (product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_variants_active ON public.product_variants USING btree (active);
CREATE INDEX IF NOT EXISTS idx_variants_collection ON public.product_variants USING btree (collection_id);
CREATE INDEX IF NOT EXISTS idx_variants_color ON public.product_variants USING btree (color);
CREATE INDEX IF NOT EXISTS idx_variants_product ON public.product_variants USING btree (product_id);
CREATE INDEX IF NOT EXISTS idx_variants_sku ON public.product_variants USING btree (sku);
CREATE INDEX IF NOT EXISTS idx_variants_stock ON public.product_variants USING btree (stock_quantity);
CREATE INDEX IF NOT EXISTS products_old_slugs_idx ON public.products USING gin (old_slugs);

-- ---------------------------------------------------------------- FUNCTIONS
CREATE OR REPLACE FUNCTION public.admin_delete_order(p_order_id uuid, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_number text;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select order_number, status into v_number, v_status from public.orders where id = p_order_id;
  if v_number is null then
    raise exception 'Order not found';
  end if;
  if p_code is null or p_code <> right(v_number, 4) then
    raise exception 'Wrong code';
  end if;

  -- Orders that are still holding stock (not cancelled, not delivered) give it back.
  if v_status not in ('cancelled', 'delivered') then
    update public.product_variants v
    set stock_quantity = v.stock_quantity + oi.qty,
        is_available = case when v.stock_quantity <= 0 then true else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = p_order_id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id;
  end if;

  delete from public.orders where id = p_order_id; -- order_items go with it (cascade)
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_expire_unpaid_orders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return public.expire_unpaid_orders(3);
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reopen_order(p_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'cancelled' then
    raise exception 'Only a cancelled order can be re-opened';
  end if;
  if v_order.shipped_at is not null then
    raise exception 'A shipped order cannot be re-opened';
  end if;
  if v_order.payment_status = 'refunded' then
    raise exception 'A refunded order cannot be re-opened';
  end if;

  update public.orders
  set status = 'confirmed',
      payment_status = case when payment_method = 'cod' then payment_status else 'paid' end,
      cancel_reason = null
  where id = p_order_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_reset_orders(p_confirm text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_confirm is distinct from 'RESET' then
    raise exception 'Type RESET to confirm';
  end if;

  update public.product_variants v
  set stock_quantity = v.stock_quantity + oi.qty,
      is_available = case when v.stock_quantity <= 0 then true else v.is_available end
  from (
    select i.variant_id, sum(i.quantity) as qty
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.variant_id is not null and o.status not in ('cancelled', 'delivered')
    group by i.variant_id
  ) oi
  where v.id = oi.variant_id;

  delete from public.orders where true;
  update public.site_settings set stats_reset_at = now() where id = true;
end;
$function$;

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

CREATE OR REPLACE FUNCTION public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Invalid quantity';
  end if;

  update public.product_variants
  set stock_quantity = stock_quantity - p_quantity,
      is_available = case when (stock_quantity - p_quantity) <= 0 then false else is_available end
  where id = p_variant_id
    and stock_quantity >= p_quantity; -- prevents negative stock under concurrency

  if not found then
    raise exception 'Insufficient stock for variant %', p_variant_id;
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.expire_unpaid_orders(p_hours integer DEFAULT 3)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n integer;
begin
  update public.orders
  set status = 'cancelled', cancel_reason = 'expired'
  where payment_method = 'upi'
    and payment_status = 'pending'
    and status = 'pending'
    and payment_reference is null
    and public.unpaid_order_expiry(created_at, p_hours) < now();
  get diagnostics n = row_count;
  return n;
end;
$function$;

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS text
 LANGUAGE sql
 SET search_path TO 'public'
AS $function$
  select 'AAR' || to_char(now(), 'YYMMDD') || lpad(nextval('public.order_number_seq')::text, 6, '0');
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, full_name, email, mobile, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'mobile', ''),
    'customer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.orders_status_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_old integer;
  v_new integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if current_user in ('postgres', 'supabase_admin') then
    return new; -- manual fix from the SQL Editor
  end if;

  if old.status in ('cancelled', 'delivered') then
    raise exception 'This order is already % and can no longer be changed', old.status;
  end if;

  if new.status = 'cancelled' then
    if old.status = 'shipped' then
      raise exception 'A shipped order cannot be cancelled';
    end if;
    return new;
  end if;

  v_old := array_position(array['pending', 'confirmed', 'processing', 'shipped', 'delivered'], old.status);
  v_new := array_position(array['pending', 'confirmed', 'processing', 'shipped', 'delivered'], new.status);
  if v_new is null or v_old is null or v_new <= v_old then
    raise exception 'Order status cannot go back from % to %', old.status, new.status;
  end if;

  if new.status in ('shipped', 'delivered') and new.payment_method <> 'cod' and new.payment_status <> 'paid' then
    raise exception 'Payment is not confirmed yet';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.orders_sync_stock_on_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_need int;
  v_done int;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v
    set stock_quantity = v.stock_quantity + oi.qty,
        is_available = case when v.stock_quantity <= 0 then true else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id;

  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    select count(distinct variant_id) into v_need
    from public.order_items
    where order_id = new.id and variant_id is not null;

    update public.product_variants v
    set stock_quantity = v.stock_quantity - oi.qty,
        is_available = case when (v.stock_quantity - oi.qty) <= 0 then false else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id
      and v.stock_quantity >= oi.qty;

    get diagnostics v_done = row_count;
    if v_done < v_need then
      raise exception 'Not enough stock to reopen this order';
    end if;
  end if;

  return null;
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

CREATE OR REPLACE FUNCTION public.profiles_block_role_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- auth.uid() is null for SQL Editor / service role, so you can still set admins manually
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.short_product_slug(p_name text, p_parent_sku text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.submit_payment_reference(p_order_id uuid, p_reference text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ref text := upper(regexp_replace(coalesce(p_reference, ''), '\s', '', 'g'));
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid();
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.payment_method <> 'upi' or v_order.payment_status = 'paid' then
    raise exception 'Payment for this order is already received';
  end if;
  if v_ref ~ '^(.)\1+$'
     or not (v_ref ~ '^[0-9]{12}$'
             or (v_ref ~ '^[A-Z0-9]{12,35}$' and length(regexp_replace(v_ref, '[^0-9]', '', 'g')) >= 6)) then
    raise exception 'Enter the 12-digit UTR / transaction number from your UPI app';
  end if;

  update public.orders
  set payment_reference = v_ref, payment_reference_at = now()
  where id = p_order_id;
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

CREATE OR REPLACE FUNCTION public.unpaid_order_expiry(p_created timestamp with time zone, p_hours integer DEFAULT 3)
 RETURNS timestamp with time zone
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case
    when extract(hour from (p_created at time zone 'Asia/Kolkata')) >= 7
     and extract(hour from (p_created at time zone 'Asia/Kolkata')) < 18
      then p_created + make_interval(hours => p_hours)
    when extract(hour from (p_created at time zone 'Asia/Kolkata')) >= 18
      then (((p_created at time zone 'Asia/Kolkata')::date + 1) + time '10:00') at time zone 'Asia/Kolkata'
    else (((p_created at time zone 'Asia/Kolkata')::date) + time '10:00') at time zone 'Asia/Kolkata'
  end;
$function$;

-- ---------------------------------------------------------------- TRIGGERS
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.addresses FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.cart_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.collections FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.hero_slides FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_orders_status_guard BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION orders_status_guard();
CREATE TRIGGER trg_orders_sync_stock AFTER UPDATE OF status ON public.orders FOR EACH ROW WHEN ((old.status IS DISTINCT FROM new.status)) EXECUTE FUNCTION orders_sync_stock_on_status();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_block_role_change BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION profiles_block_role_change();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------- ROW LEVEL SECURITY
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.categories enable row level security;
alter table public.category_collections enable row level security;
alter table public.collections enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupons enable row level security;
alter table public.hero_slides enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.site_settings enable row level security;
alter table public.wishlist_items enable row level security;

create policy "addresses_owner_all" on public.addresses for all to public
  using (((auth.uid() = user_id) OR is_admin()))
  with check ((auth.uid() = user_id));
create policy "cart_owner_all" on public.cart_items for all to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "categories_admin_write" on public.categories for all to public
  using (is_admin())
  with check (is_admin());
create policy "categories_public_read" on public.categories for select to public
  using (((active = true) OR is_admin()));
create policy "category_collections_admin_write" on public.category_collections for all to public
  using (is_admin())
  with check (is_admin());
create policy "category_collections_public_read" on public.category_collections for select to public
  using (true);
create policy "collections_admin_write" on public.collections for all to public
  using (is_admin())
  with check (is_admin());
create policy "collections_public_read" on public.collections for select to public
  using (((active = true) OR is_admin()));
create policy "redemptions_admin_select" on public.coupon_redemptions for select to public
  using (is_admin());
create policy "coupons_admin_all" on public.coupons for all to public
  using (is_admin())
  with check (is_admin());
create policy "hero_slides_admin_write" on public.hero_slides for all to public
  using (is_admin())
  with check (is_admin());
create policy "hero_slides_public_read" on public.hero_slides for select to public
  using (((active = true) OR is_admin()));
create policy "order_items_admin_write" on public.order_items for all to public
  using (is_admin())
  with check (is_admin());
create policy "order_items_owner_select" on public.order_items for select to public
  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR is_admin())))));
create policy "orders_admin_update" on public.orders for update to public
  using (is_admin())
  with check (is_admin());
create policy "orders_owner_select" on public.orders for select to public
  using (((auth.uid() = user_id) OR is_admin()));
create policy "images_admin_write" on public.product_images for all to public
  using (is_admin())
  with check (is_admin());
create policy "images_public_read" on public.product_images for select to public
  using (true);
create policy "variants_admin_write" on public.product_variants for all to public
  using (is_admin())
  with check (is_admin());
create policy "variants_public_read" on public.product_variants for select to public
  using (((active = true) OR is_admin()));
create policy "products_admin_write" on public.products for all to public
  using (is_admin())
  with check (is_admin());
create policy "products_public_read" on public.products for select to public
  using (((active = true) OR is_admin()));
create policy "profiles_insert_own" on public.profiles for insert to public
  with check (((auth.uid() = user_id) AND (role = 'customer'::text)));
create policy "profiles_select_own_or_admin" on public.profiles for select to public
  using (((auth.uid() = user_id) OR is_admin()));
create policy "profiles_update_own" on public.profiles for update to public
  using ((auth.uid() = user_id))
  with check ((auth.uid() = user_id));
create policy "reviews_admin_all" on public.reviews for all to public
  using (is_admin())
  with check (is_admin());
create policy "reviews_public_select" on public.reviews for select to public
  using ((status = 'published'::text));
create policy "site_settings_admin_write" on public.site_settings for update to public
  using (is_admin())
  with check (is_admin());
create policy "site_settings_public_read" on public.site_settings for select to public
  using (true);
create policy "wishlist_owner_delete" on public.wishlist_items for delete to public
  using ((user_id = auth.uid()));
create policy "wishlist_owner_insert" on public.wishlist_items for insert to public
  with check ((user_id = auth.uid()));
create policy "wishlist_owner_select" on public.wishlist_items for select to public
  using ((user_id = auth.uid()));
create policy "admin_delete_category_images" on storage.objects for delete to public
  using (((bucket_id = 'category-images'::text) AND is_admin()));
create policy "admin_delete_collection_images" on storage.objects for delete to public
  using (((bucket_id = 'collection-images'::text) AND is_admin()));
create policy "admin_delete_hero_images" on storage.objects for delete to public
  using (((bucket_id = 'hero-images'::text) AND is_admin()));
create policy "admin_delete_product_images" on storage.objects for delete to public
  using (((bucket_id = 'product-images'::text) AND is_admin()));
create policy "admin_delete_site_images" on storage.objects for delete to public
  using (((bucket_id = 'site-images'::text) AND is_admin()));
create policy "admin_read_category_images" on storage.objects for select to authenticated
  using (((bucket_id = 'category-images'::text) AND is_admin()));
create policy "admin_read_collection_images" on storage.objects for select to authenticated
  using (((bucket_id = 'collection-images'::text) AND is_admin()));
create policy "admin_read_hero_images" on storage.objects for select to authenticated
  using (((bucket_id = 'hero-images'::text) AND is_admin()));
create policy "admin_read_product_images" on storage.objects for select to authenticated
  using (((bucket_id = 'product-images'::text) AND is_admin()));
create policy "admin_read_site_images" on storage.objects for select to authenticated
  using (((bucket_id = 'site-images'::text) AND is_admin()));
create policy "admin_update_category_images" on storage.objects for update to public
  using (((bucket_id = 'category-images'::text) AND is_admin()));
create policy "admin_update_collection_images" on storage.objects for update to public
  using (((bucket_id = 'collection-images'::text) AND is_admin()));
create policy "admin_update_hero_images" on storage.objects for update to public
  using (((bucket_id = 'hero-images'::text) AND is_admin()));
create policy "admin_update_product_images" on storage.objects for update to public
  using (((bucket_id = 'product-images'::text) AND is_admin()));
create policy "admin_update_site_images" on storage.objects for update to public
  using (((bucket_id = 'site-images'::text) AND is_admin()));
create policy "admin_write_category_images" on storage.objects for insert to public
  with check (((bucket_id = 'category-images'::text) AND is_admin()));
create policy "admin_write_collection_images" on storage.objects for insert to public
  with check (((bucket_id = 'collection-images'::text) AND is_admin()));
create policy "admin_write_hero_images" on storage.objects for insert to public
  with check (((bucket_id = 'hero-images'::text) AND is_admin()));
create policy "admin_write_product_images" on storage.objects for insert to public
  with check (((bucket_id = 'product-images'::text) AND is_admin()));
create policy "admin_write_site_images" on storage.objects for insert to public
  with check (((bucket_id = 'site-images'::text) AND is_admin()));

-- ---------------------------------------------------------------- STORAGE BUCKETS (public read of files by link)
insert into storage.buckets (id, name, public) values ('category-images', 'category-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('collection-images', 'collection-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('hero-images', 'hero-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('site-images', 'site-images', true) on conflict (id) do nothing;

-- ---------------------------------------------------------------- WHO MAY CALL THE FUNCTIONS
-- (functions not listed here keep Supabase's default: everybody may call them)
revoke execute on function public.admin_delete_order(uuid, text) from public, anon;
grant execute on function public.admin_delete_order(uuid, text) to authenticated;
revoke execute on function public.admin_expire_unpaid_orders() from public, anon;
grant execute on function public.admin_expire_unpaid_orders() to authenticated;
revoke execute on function public.admin_reopen_order(uuid) from public, anon;
grant execute on function public.admin_reopen_order(uuid) to authenticated;
revoke execute on function public.admin_reset_orders(text) from public, anon;
grant execute on function public.admin_reset_orders(text) to authenticated;
revoke execute on function public.compute_coupon(text, uuid, numeric) from public, anon, authenticated;
revoke execute on function public.decrement_variant_stock(uuid, integer) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_orders(integer) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.orders_sync_stock_on_status() from public, anon, authenticated;
revoke execute on function public.preview_coupon(text, numeric) from public, anon;
grant execute on function public.preview_coupon(text, numeric) to authenticated;
revoke execute on function public.submit_payment_reference(uuid, text) from public, anon;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

-- ---------------------------------------------------------------- SCHEDULED JOBS (pg_cron) - names and times only
--   aaraah-expire-unpaid-orders      */15 * * * *
--   aaraah-expired-order-emails      5,20,35,50 * * * *
--   aaraah-weekly-backup             30 21 * * 6
-- Commands: see supabase/migrations 0031, 0036 and the weekly-backup notes in the project docs.
