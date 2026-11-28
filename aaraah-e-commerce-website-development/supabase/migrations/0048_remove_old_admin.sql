-- 0048: purana admin account (blackpur.com@gmail.com) hatana. Supabase -> SQL Editor -> New query -> paste -> Run.
-- Pehle admin ka role hatata hai (customer), uske phone-alert subscriptions hatata hai, phir account delete karta hai.
-- Agar is account ne kabhi order diya hai to account delete NAHI hota (orders safe rehte hain); sirf admin hat jata hai.
-- Last me ek chhoti list dikhti hai: wahi result mujhe bhejo.
update public.profiles
set role = 'customer'
where user_id = (select id from auth.users where lower(email) = 'blackpur.com@gmail.com');

delete from public.push_subscriptions
where user_id = (select id from auth.users where lower(email) = 'blackpur.com@gmail.com');

delete from auth.users u
where lower(u.email) = 'blackpur.com@gmail.com'
  and not exists (select 1 from public.orders o where o.user_id = u.id);

select 'admin' as kind, u.email::text as item, 'role=' || p.role::text as detail
from public.profiles p join auth.users u on u.id = p.user_id
where p.role = 'admin'
union all
select 'purana account', 'blackpur.com@gmail.com',
       case when exists (select 1 from auth.users where lower(email) = 'blackpur.com@gmail.com')
            then 'ABHI BHI HAI (isne order diya hai, ab sirf customer hai)' else 'DELETE ho gaya' end;
