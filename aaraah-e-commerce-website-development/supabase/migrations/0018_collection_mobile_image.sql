-- =============================================================================
-- 0018: separate collection image for phones
-- collections.image stays the web/desktop image. collections.mobile_image is
-- optional: when set, phones (screen narrower than 640px) show it instead.
-- Safe to run more than once.
-- =============================================================================

alter table public.collections
  add column if not exists mobile_image text;
