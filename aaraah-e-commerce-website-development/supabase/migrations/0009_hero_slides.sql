-- =============================================================================
-- 0009: hero carousel slides
-- Lets the homepage's top banner carousel be managed from the admin panel
-- instead of being hardcoded in the site's code.
-- =============================================================================

create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image text not null,
  cta_text text,
  cta_link text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hero_slides_active on public.hero_slides (active, sort_order);

alter table public.hero_slides enable row level security;

create policy "hero_slides_public_read" on public.hero_slides
  for select using (active = true or public.is_admin());

create policy "hero_slides_admin_write" on public.hero_slides
  for all using (public.is_admin()) with check (public.is_admin());

-- Reuse the same updated_at trigger pattern as the other tables.
create trigger trg_set_updated_at before update on public.hero_slides
  for each row execute function public.set_updated_at();

-- Storage bucket for hero banner images, matching the pattern used for
-- product/category/collection images.
insert into storage.buckets (id, name, public)
values ('hero-images', 'hero-images', true)
on conflict (id) do nothing;

create policy "public_read_hero_images" on storage.objects
  for select using (bucket_id = 'hero-images');

create policy "admin_write_hero_images" on storage.objects
  for insert with check (bucket_id = 'hero-images' and public.is_admin());
create policy "admin_update_hero_images" on storage.objects
  for update using (bucket_id = 'hero-images' and public.is_admin());
create policy "admin_delete_hero_images" on storage.objects
  for delete using (bucket_id = 'hero-images' and public.is_admin());
