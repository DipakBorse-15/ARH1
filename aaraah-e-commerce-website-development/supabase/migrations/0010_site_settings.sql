-- =============================================================================
-- 0010: site-wide settings (logo, announcement bar) for the admin Home Page
-- Editor. A single-row "singleton" table: id is fixed so there's always
-- exactly one settings row to read and update.
-- =============================================================================

create table if not exists public.site_settings (
  id boolean primary key default true,
  logo_url text,
  site_name text not null default 'AARAAH',
  tagline text,
  announcement_text text,
  announcement_link text,
  announcement_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint site_settings_singleton check (id)
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

create policy "site_settings_public_read" on public.site_settings
  for select using (true);

create policy "site_settings_admin_write" on public.site_settings
  for update using (public.is_admin()) with check (public.is_admin());

create trigger trg_set_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- Storage bucket for the site logo.
insert into storage.buckets (id, name, public)
values ('site-images', 'site-images', true)
on conflict (id) do nothing;

create policy "public_read_site_images" on storage.objects
  for select using (bucket_id = 'site-images');

create policy "admin_write_site_images" on storage.objects
  for insert with check (bucket_id = 'site-images' and public.is_admin());
create policy "admin_update_site_images" on storage.objects
  for update using (bucket_id = 'site-images' and public.is_admin());
create policy "admin_delete_site_images" on storage.objects
  for delete using (bucket_id = 'site-images' and public.is_admin());
