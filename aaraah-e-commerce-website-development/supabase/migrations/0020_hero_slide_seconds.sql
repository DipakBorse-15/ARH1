-- =============================================================================
-- 0020: how many seconds each uploaded hero banner stays before the carousel
-- moves on (one value for all uploaded banners; set in Admin → Home Editor → Banners).
-- The built-in default banner (slide 1) is fixed at 5 seconds in code.
-- =============================================================================

alter table public.site_settings
  add column if not exists hero_slide_seconds integer not null default 5
  check (hero_slide_seconds between 2 and 60);
