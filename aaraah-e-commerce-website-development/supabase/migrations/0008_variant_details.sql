-- =============================================================================
-- 0008: rich per-variant (child SKU) fields from the AARAAH listing template
-- Description and bullets already vary by colour (0006); these round out the
-- rest of the sheet. Fields marked "internal" are never rendered on the
-- storefront — they exist for search/filtering only.
-- =============================================================================

alter table public.product_variants
  add column if not exists description text,                 -- overrides products.description when set
  add column if not exists work_type text,                    -- e.g. "Phulkari"
  add column if not exists work_pattern text,                 -- e.g. "Floral"
  add column if not exists best_for text,                     -- occasions, e.g. "Festivals, Party, Wedding"
  add column if not exists manufacturer text,
  add column if not exists included_components text,          -- e.g. "Blouse"
  add column if not exists discount_percent numeric,          -- explicit, not computed from price/sale_price
  add column if not exists discount_amount numeric,           -- explicit rupee amount saved
  add column if not exists color_group text,                  -- "Main Color" — internal search bucket, never shown
  add column if not exists fabric_type text,                  -- internal only (already mentioned in bullets)
  add column if not exists search_keywords text;               -- internal SEO only, never shown
