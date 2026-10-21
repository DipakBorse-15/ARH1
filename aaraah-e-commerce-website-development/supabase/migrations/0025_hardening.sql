-- =============================================================================
-- AARAAH.IN — 0025: small security hardening. Run once in Supabase SQL Editor.
-- Safe to run more than once.
-- =============================================================================

-- A customer may only ever create their own profile as a normal "customer"
-- (never as admin). Admin is set by you in the SQL Editor / table editor.
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id and role = 'customer');
