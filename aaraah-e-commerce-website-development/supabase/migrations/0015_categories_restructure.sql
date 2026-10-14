-- =============================================================================
-- 0015: Category restructure -> 6 categories
--   Sarees | Kurties & Kurta Sets | Lehengas | Dupattas & Stoles | Bottomwear | Blouses
--
-- Safe to run more than once. Existing categories are RENAMED IN PLACE (not
-- deleted), so every product already linked to them stays linked.
-- =============================================================================

-- 1) Saree -> Sarees
update public.categories
   set name = 'Sarees',
       slug = 'sarees',
       description = 'Timeless drapes in silk, cotton, chiffon and georgette.',
       active = true
 where slug = 'saree'
   and not exists (select 1 from public.categories where slug = 'sarees');

-- 2) Kurti -> Kurties & Kurta Sets
update public.categories
   set name = 'Kurties & Kurta Sets',
       slug = 'kurties-kurta-sets',
       description = 'Everyday kurties and coordinated kurta sets with dupatta.',
       active = true
 where slug = 'kurti'
   and not exists (select 1 from public.categories where slug = 'kurties-kurta-sets');

-- 3) Old "Kurta Set with Dupatta" is merged into Kurties & Kurta Sets:
--    move its products across, then switch the old category off (not deleted).
update public.products
   set category_id = (select id from public.categories where slug = 'kurties-kurta-sets')
 where category_id = (select id from public.categories where slug = 'kurta-set-with-dupatta')
   and exists (select 1 from public.categories where slug = 'kurties-kurta-sets');

update public.categories
   set active = false
 where slug = 'kurta-set-with-dupatta'
   and exists (select 1 from public.categories where slug = 'kurties-kurta-sets');

-- 4) New categories
insert into public.categories (name, slug, description, active) values
  ('Lehengas',          'lehengas',          'Bridal, festive and party-wear lehengas.',        true),
  ('Dupattas & Stoles', 'dupattas-stoles',   'Banarasi, phulkari, bandhani and more.',          true),
  ('Bottomwear',        'bottomwear',        'Palazzos, leggings, churidars and salwars.',      true),
  ('Blouses',           'blouses',           'Readymade and designer blouses.',                 true)
on conflict (slug) do nothing;

-- 5) "Dress Material" is not in the new list -> hide it (data is kept).
--    BEFORE running this file, check whether any products still use it:
--      select count(*) from public.products
--       where category_id = (select id from public.categories where slug = 'dress-material');
--    If the count is > 0, move them to a new category first (admin panel -> Products),
--    otherwise those products will have no visible category.
update public.categories set active = false where slug = 'dress-material';
