-- 0034: a colour's selling price (sale_price) can never be higher than its MRP (price).
-- Why: if sale_price > price, the website shows the MRP but checkout charges the higher
-- sale_price - the customer would pay more than the price they saw.
--
-- STEP 1 (run this first, on its own). It must return ZERO rows:
--
--   select sku, price, sale_price
--   from public.product_variants
--   where sale_price is not null and sale_price > price;
--
-- If it returns rows, do NOT run step 2. Send me the rows and I will give you the fix.
--
-- STEP 2 (only when step 1 returned zero rows): run everything below.
-- To undo later:  alter table public.product_variants drop constraint product_variants_sale_le_price;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_variants_sale_le_price'
      and conrelid = 'public.product_variants'::regclass
  ) then
    alter table public.product_variants
      add constraint product_variants_sale_le_price
      check (sale_price is null or sale_price <= price);
  end if;
end $$;
