-- 1) Mobile number typed at sign-up is stored in auth metadata; copy it into the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email, mobile, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    nullif(new.raw_user_meta_data->>'mobile', ''),
    'customer'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Backfill: existing customers whose mobile never reached their profile.
update public.profiles p
set mobile = nullif(u.raw_user_meta_data->>'mobile', '')
from auth.users u
where u.id = p.user_id
  and (p.mobile is null or p.mobile = '')
  and nullif(u.raw_user_meta_data->>'mobile', '') is not null;

-- 2) Remove duplicate saved addresses (same person + same address text), keep the oldest
--    (prefer the default one).
delete from public.addresses a
using (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(full_name)), btrim(mobile), lower(btrim(line1)),
                        lower(btrim(coalesce(line2, ''))), lower(btrim(city)), lower(btrim(state)), btrim(pincode)
           order by is_default desc, created_at asc
         ) as rn
  from public.addresses
) d
where a.id = d.id and d.rn > 1;
