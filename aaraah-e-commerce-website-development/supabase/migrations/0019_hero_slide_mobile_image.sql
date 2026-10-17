-- =============================================================================
-- 0019: separate hero banner image for phones
-- hero_slides.image stays the web banner. hero_slides.mobile_image is optional:
-- when set, phones (screen narrower than 640px) show it instead, in a taller
-- frame. Slides without one keep today's look. Safe to run more than once.
-- =============================================================================

alter table public.hero_slides
  add column if not exists mobile_image text;
