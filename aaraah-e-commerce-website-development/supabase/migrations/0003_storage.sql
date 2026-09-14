-- =============================================================================
-- AARAAH.IN — Storage buckets & policies
-- Buckets: product-images, category-images, collection-images (all public-read)
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('category-images', 'category-images', true),
  ('collection-images', 'collection-images', true)
on conflict (id) do nothing;

-- Public read access for all storefront imagery.
create policy "public_read_product_images" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "public_read_category_images" on storage.objects
  for select using (bucket_id = 'category-images');

create policy "public_read_collection_images" on storage.objects
  for select using (bucket_id = 'collection-images');

-- Only admins may upload/update/delete storefront imagery.
create policy "admin_write_product_images" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());
create policy "admin_update_product_images" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());
create policy "admin_delete_product_images" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());

create policy "admin_write_category_images" on storage.objects
  for insert with check (bucket_id = 'category-images' and public.is_admin());
create policy "admin_update_category_images" on storage.objects
  for update using (bucket_id = 'category-images' and public.is_admin());
create policy "admin_delete_category_images" on storage.objects
  for delete using (bucket_id = 'category-images' and public.is_admin());

create policy "admin_write_collection_images" on storage.objects
  for insert with check (bucket_id = 'collection-images' and public.is_admin());
create policy "admin_update_collection_images" on storage.objects
  for update using (bucket_id = 'collection-images' and public.is_admin());
create policy "admin_delete_collection_images" on storage.objects
  for delete using (bucket_id = 'collection-images' and public.is_admin());
