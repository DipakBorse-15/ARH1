-- =============================================================================
-- 0011: site-wide font choice, managed from the Home Page Editor.
-- =============================================================================

alter table public.site_settings
  add column if not exists font_family text not null default 'Inter';
