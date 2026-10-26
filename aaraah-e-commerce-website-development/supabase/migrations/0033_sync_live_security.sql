-- 0033: puts into the repo the security setup that ALREADY exists in the live Supabase database.
-- Checked on the live database on 2026-10-26:
--   * a customer cannot change a profile's role (trigger trg_profiles_block_role_change)
--   * a customer cannot insert orders / order_items directly (only the create-order Edge Function does)
-- The repo's older migrations (0001 / 0002) did not have these, so a database rebuilt only from
-- the repo would be missing them.
--
-- You do NOT need to run this on the live database (it would change nothing there).
-- Its real use: rebuilding the database from scratch (new Supabase project) - run it LAST.

-- 1) Customers cannot place orders by writing to the tables directly. -------------------------
drop policy if exists "orders_owner_insert" on public.orders;
drop policy if exists "order_items_owner_insert" on public.order_items;

-- 2) Only an admin can change a profile's role. -----------------------------------------------
-- (auth.uid() is null in the SQL Editor / service role, so you can still set admins by hand.)
create or replace function public.profiles_block_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and auth.uid() is not null and not public.is_admin() then
    raise exception 'role cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_block_role_change on public.profiles;
create trigger trg_profiles_block_role_change
  before update on public.profiles
  for each row execute function public.profiles_block_role_change();
