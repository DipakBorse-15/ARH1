-- =============================================================================
-- AARAAH.IN — 0027: SEO title + SEO description for products, categories, collections
-- Run once in Supabase SQL Editor BEFORE uploading the matching site files.
-- Safe to run more than once. Nothing existing is changed: new columns start empty,
-- and an empty SEO field simply means "use the normal name / description".
-- =============================================================================

alter table public.products    add column if not exists seo_title text;
alter table public.products    add column if not exists seo_description text;

alter table public.categories  add column if not exists seo_title text;
alter table public.categories  add column if not exists seo_description text;

alter table public.collections add column if not exists seo_title text;
alter table public.collections add column if not exists seo_description text;
