-- =============================================================================
-- 0017: per-category hero banners
-- A hero slide can now belong to one category (shown only on that category's
-- page). Slides with category_id NULL are the HOME banners, exactly as before,
-- so every existing slide keeps showing on the home page.
-- Safe to run more than once.
-- =============================================================================

alter table public.hero_slides
  add column if not exists category_id uuid references public.categories(id) on delete cascade;

create index if not exists idx_hero_slides_category on public.hero_slides (category_id, active, sort_order);
