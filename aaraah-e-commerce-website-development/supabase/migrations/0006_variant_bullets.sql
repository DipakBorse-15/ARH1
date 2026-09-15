-- =============================================================================
-- 0006: per-variant bullet points
-- Amazon-style listings change the bullet text per colour (e.g. "Saree Color : Red").
-- Bullets now live on the variant; products.bullet_points stays as the fallback
-- for variants that do not define their own.
-- =============================================================================

alter table public.product_variants
  add column if not exists bullet_points text[] not null default '{}';
