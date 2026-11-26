-- 0047 (OPTIONAL, baad me): admin ke liye 2-step login ZAROORI.
-- ABHI MAT CHALAO. Pehle dono admin accounts me 2-step chalu karo aur dono se login test karo (Admin -> More -> Security).
-- Is se pehle ka 0044 sirf unhe rokta tha jinhone 2-step set kar rakha ho. Ye uske upar: bina 6-digit code wale session ko
-- database me admin maana hi nahi jayega (aal2 = code daala hua session).
-- Agar kabhi bahar ho jao: neeche wala ROLLBACK akela paste karke Run karo (SQL Editor par ye hamesha chalta hai).
create or replace function public.is_admin()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
  and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2';
$function$;

-- ROLLBACK (0044 wala purana tareeka wapas):
-- create or replace function public.is_admin()
--  returns boolean
--  language sql
--  stable security definer
--  set search_path to 'public'
-- as $function$
--   select exists (
--     select 1 from public.profiles p
--     where p.user_id = auth.uid() and p.role = 'admin'
--   )
--   and (
--     coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
--     or not exists (
--       select 1 from auth.mfa_factors f
--       where f.user_id = auth.uid() and f.status = 'verified'
--     )
--   );
-- $function$;
