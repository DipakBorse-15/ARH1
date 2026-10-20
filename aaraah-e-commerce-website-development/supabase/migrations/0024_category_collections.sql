-- =============================================================================
-- AARAAH.IN — 0024: collections per category
-- For each category the admin picks which collections appear, their position,
-- and a web + mobile image of their own. Run once in Supabase SQL Editor.
-- Safe to run more than once.
-- =============================================================================

create table if not exists public.category_collections (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  image text,
  mobile_image text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (category_id, collection_id)
);

create index if not exists idx_category_collections_cat on public.category_collections (category_id, sort_order);

alter table public.category_collections enable row level security;

drop policy if exists "category_collections_public_read" on public.category_collections;
create policy "category_collections_public_read" on public.category_collections
  for select using (true);

drop policy if exists "category_collections_admin_write" on public.category_collections;
create policy "category_collections_admin_write" on public.category_collections
  for all using (public.is_admin()) with check (public.is_admin());
