-- 0049: Instagram / Facebook links (footer icons). Admin -> Home Editor -> Social Links se badalte hain.
-- Supabase -> SQL Editor -> New query -> paste -> Run.
alter table public.site_settings add column if not exists instagram_url text;
alter table public.site_settings add column if not exists facebook_url text;

update public.site_settings
set instagram_url = coalesce(instagram_url, 'https://www.instagram.com/a.aaraah/'),
    facebook_url  = coalesce(facebook_url,  'https://www.facebook.com/profile.php?id=61579910732665')
where id = true;

select instagram_url, facebook_url from public.site_settings where id = true;
