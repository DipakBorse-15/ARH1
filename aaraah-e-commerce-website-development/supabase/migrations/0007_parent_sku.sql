-- =============================================================================
-- 0007: remember the Amazon parent SKU on each product
-- Lets a later import attach a new colour (e.g. 101S102) to the product group
-- that an earlier import created (parent 101S101-P) instead of duplicating it.
-- =============================================================================

alter table public.products
  add column if not exists parent_sku text;

create unique index if not exists idx_products_parent_sku
  on public.products (parent_sku)
  where parent_sku is not null;
