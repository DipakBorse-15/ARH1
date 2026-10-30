-- Small (thumbnail) copy of each product photo for cards, swatches, cart and wishlist.
-- The original photo (url / storage_path) is NOT touched, so Google, Merchant Center and old orders keep working.
alter table public.product_images add column if not exists thumb_url text;
alter table public.product_images add column if not exists thumb_path text;
