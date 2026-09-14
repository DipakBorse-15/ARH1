-- =============================================================================
-- AARAAH.IN — Core schema
-- Parent Product (design) -> Product Variant (color/size/etc.) -> Variant Images
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text,
  email text,
  mobile text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles (role);

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_slug on public.categories (slug);
create index if not exists idx_categories_active on public.categories (active);

-- ---------------------------------------------------------------------------
-- collections
-- ---------------------------------------------------------------------------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_collections_slug on public.collections (slug);
create index if not exists idx_collections_active on public.collections (active);

-- ---------------------------------------------------------------------------
-- products (parent design group)
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand text not null default 'AARAAH',
  name text not null,
  slug text not null unique,
  description text,
  bullet_points text[] not null default '{}',
  category_id uuid references public.categories (id) on delete set null,
  collection_id uuid references public.collections (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_slug on public.products (slug);
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_collection on public.products (collection_id);
create index if not exists idx_products_active on public.products (active);
create index if not exists idx_products_created_at on public.products (created_at desc);

-- ---------------------------------------------------------------------------
-- product_variants
-- Extendable attribute bag (color, size, fabric, pattern, length, ...)
-- ---------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text not null unique,
  color text,
  color_hex text,
  attributes jsonb not null default '{}'::jsonb,
  price numeric(10, 2) not null check (price >= 0),
  sale_price numeric(10, 2) check (sale_price is null or sale_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_available boolean not null default true,
  active boolean not null default true,
  variant_info text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_variants_product on public.product_variants (product_id);
create index if not exists idx_variants_sku on public.product_variants (sku);
create index if not exists idx_variants_color on public.product_variants (color);
create index if not exists idx_variants_active on public.product_variants (active);
create index if not exists idx_variants_stock on public.product_variants (stock_quantity);

-- ---------------------------------------------------------------------------
-- product_images (belong to a specific variant)
-- ---------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  storage_path text not null,
  url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_images_variant on public.product_images (variant_id);

-- ---------------------------------------------------------------------------
-- addresses
-- ---------------------------------------------------------------------------
create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  mobile text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_addresses_user on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- cart_items (variant-specific!)
-- ---------------------------------------------------------------------------
create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create index if not exists idx_cart_user on public.cart_items (user_id);

-- ---------------------------------------------------------------------------
-- orders / order_items (snapshotted!)
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users (id) on delete cascade,
  full_name text not null,
  mobile text not null,
  email text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  pincode text not null,
  payment_method text not null default 'cod',
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric(10, 2) not null default 0,
  shipping_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_user on public.orders (user_id);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_orders_created_at on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  product_name text not null,
  brand text not null default 'AARAAH',
  color text,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10, 2) not null,
  line_total numeric(10, 2) not null,
  image_url text
);

create index if not exists idx_order_items_order on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['profiles','categories','collections','products','product_variants','addresses','cart_items','orders']
  loop
    execute format('drop trigger if exists trg_set_updated_at on public.%I;', t);
    execute format('create trigger trg_set_updated_at before update on public.%I for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- auto-create profile row on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    'customer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- order number generator
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 100001;

create or replace function public.generate_order_number()
returns text
language sql
as $$
  select 'AAR' || to_char(now(), 'YYMMDD') || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------------
-- helper: is the current user an admin?
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;
