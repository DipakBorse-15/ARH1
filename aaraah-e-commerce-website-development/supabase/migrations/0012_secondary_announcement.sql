-- =============================================================================
-- 0012: a second, lighter-styled offer strip beneath the main announcement bar
-- (matches the two-tier promo bar pattern many fashion sites use).
-- =============================================================================

alter table public.site_settings
  add column if not exists announcement2_text text,
  add column if not exists announcement2_link text,
  add column if not exists announcement2_active boolean not null default false;
