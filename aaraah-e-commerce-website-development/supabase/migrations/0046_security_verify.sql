-- 0046: SECURITY CHECK (sirf padhta hai, kuch badalta nahi). Supabase -> SQL Editor -> New query -> paste -> Run.
-- Result ki poori list copy karke Claude ko bhejo. Khaali "KHATRA" wali koi row aaye to wahi fix karni hai.
select * from (

  select '0 info' as section, 'check chala' as item, 'ok' as detail

  union all
  -- 1) public tables jinpar RLS band hai (har aisi table internet par khuli ho sakti hai)
  select '1 KHATRA: RLS band', c.relname::text, 'RLS OFF'
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all
  -- 2) aisi write-policy jo bina shart ke sabko likhne deti hai
  select '2 KHATRA: sabko write', tablename::text || ' / ' || policyname::text, cmd::text || ' roles=' || roles::text
  from pg_policies
  where schemaname = 'public' and cmd <> 'SELECT'
    and ( (cmd = 'INSERT' and coalesce(with_check, 'true') = 'true')
       or (cmd in ('UPDATE', 'DELETE', 'ALL') and coalesce(qual, 'true') = 'true') )

  union all
  -- 3) SECURITY DEFINER functions jo bina login (anon) ke chal sakte hain
  select '3 dekho: anon function', p.proname::text || '(' || pg_get_function_identity_arguments(p.oid) || ')', 'anon execute'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')

  union all
  -- 4) storage buckets
  select '4 storage bucket', b.name::text, 'public=' || b.public::text || ' size_limit=' || coalesce(b.file_size_limit::text, 'NONE') || ' mime=' || coalesce(array_to_string(b.allowed_mime_types, ','), 'ANY')
  from storage.buckets b

  union all
  -- 5) admin accounts aur unka 2-step login
  select '5 admin + 2-step', u.email::text,
         case when exists (select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')
              then '2-step CHALU' else '2-step BAND' end
  from public.profiles p join auth.users u on u.id = p.user_id
  where p.role = 'admin'

  union all
  -- 6) signup ginti (email confirm kaam kar raha hai ya nahi dekhne ke liye)
  select '6 users', 'total / email-confirm-nahi-hua',
         count(*)::text || ' / ' || count(*) filter (where email_confirmed_at is null)::text
  from auth.users

) t
order by section, item;
