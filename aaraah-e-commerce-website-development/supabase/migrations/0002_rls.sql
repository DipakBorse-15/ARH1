-- =============================================================================
-- AARAAH.IN — Row Level Security policies
-- =============================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.collections enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = user_id or public.is_admin());

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- categories / collections — public read of active rows, admin full access
-- ---------------------------------------------------------------------------
create policy "categories_public_read" on public.categories
  for select using (active = true or public.is_admin());

create policy "categories_admin_write" on public.categories
  for all using (public.is_admin()) with check (public.is_admin());

create policy "collections_public_read" on public.collections
  for select using (active = true or public.is_admin());

create policy "collections_admin_write" on public.collections
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- products / variants / images — public read of active rows, admin full access
-- ---------------------------------------------------------------------------
create policy "products_public_read" on public.products
  for select using (active = true or public.is_admin());

create policy "products_admin_write" on public.products
  for all using (public.is_admin()) with check (public.is_admin());

create policy "variants_public_read" on public.product_variants
  for select using (active = true or public.is_admin());

create policy "variants_admin_write" on public.product_variants
  for all using (public.is_admin()) with check (public.is_admin());

create policy "images_public_read" on public.product_images
  for select using (true);

create policy "images_admin_write" on public.product_images
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- addresses — strictly private to the owning customer (+ admin read)
-- ---------------------------------------------------------------------------
create policy "addresses_owner_all" on public.addresses
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- cart_items — strictly private to the owning customer
-- ---------------------------------------------------------------------------
create policy "cart_owner_all" on public.cart_items
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- orders — customers see only their own orders; admin sees & manages all
-- ---------------------------------------------------------------------------
create policy "orders_owner_select" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());

create policy "orders_owner_insert" on public.orders
  for insert with check (auth.uid() = user_id);

create policy "orders_admin_update" on public.orders
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- order_items — visible if the parent order is visible
-- ---------------------------------------------------------------------------
create policy "order_items_owner_select" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "order_items_owner_insert" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );

create policy "order_items_admin_write" on public.order_items
  for all using (public.is_admin()) with check (public.is_admin());
