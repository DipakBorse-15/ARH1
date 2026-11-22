-- 0044: admin 2-step login (authenticator app) enforced in the database.
-- RUN THIS ONLY AFTER both admins have added the authenticator app (Admin -> Security) and have
-- signed in once with the code. Safe for admins who have NOT added an app yet: for them nothing changes.
-- Rule: an admin who HAS a verified authenticator app is treated as admin only when the session has
-- entered the code (token claim aal = 'aal2'). Everyone else is exactly as before.
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
  and (
    coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors f
      where f.user_id = auth.uid() and f.status = 'verified'
    )
  );
$function$;

-- ROLLBACK (paste this alone to go back to the old behaviour):
-- create or replace function public.is_admin() returns boolean language sql stable security definer set search_path to 'public'
-- as $f$ select exists (select 1 from public.profiles p where p.user_id = auth.uid() and p.role = 'admin'); $f$;
--
-- LOCKED OUT (phone lost)? Run in SQL Editor (replace the email), then sign in with password only:
-- delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'ADMIN_EMAIL');
