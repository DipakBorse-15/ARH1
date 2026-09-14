-- =============================================================================
-- AARAAH.IN — Seed structural taxonomy (categories & collections only).
-- No product catalog is seeded here — real products must be added via the
-- admin panel so the storefront never ships with fake/placeholder listings.
-- =============================================================================

insert into public.categories (name, slug, description, active) values
  ('Saree', 'saree', 'Timeless drapes in silk, cotton, chiffon and georgette.', true),
  ('Kurti', 'kurti', 'Everyday and statement kurtis for effortless style.', true),
  ('Dress Material', 'dress-material', 'Unstitched and semi-stitched fabric sets.', true),
  ('Kurta Set with Dupatta', 'kurta-set-with-dupatta', 'Coordinated kurta, bottom and dupatta sets.', true)
on conflict (slug) do nothing;

insert into public.collections (name, slug, description, active) values
  ('New Arrival', 'new-arrival', 'Freshly added designs, first to your wardrobe.', true),
  ('Festive', 'festive', 'Rich fabrics and vivid colors for celebrations.', true),
  ('Daily Wear', 'daily-wear', 'Comfortable, breathable pieces for everyday.', true),
  ('Occasional', 'occasional', 'Statement pieces for weddings and special events.', true)
on conflict (slug) do nothing;

-- Promote a specific user to admin after they sign up, e.g.:
-- update public.profiles set role = 'admin' where email = 'owner@aaraah.in';
