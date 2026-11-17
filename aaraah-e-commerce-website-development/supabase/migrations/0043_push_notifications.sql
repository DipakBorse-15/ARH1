-- 0043: push alerts for the Aaraah Admin phone app.
-- Alerts: UTR submitted, a PAID order cancelled, a colour's stock goes below 5.
-- ("New order" is sent by the create-order function itself, after the order is fully saved.)
-- Safe to run more than once. The secret key is NOT in this file: it is added by a separate
-- one-line SQL (push-key-setup.sql) that is never stored in GitHub.

-- 1) Phones that switched alerts on (one row per phone/browser)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_admin_select on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_insert on public.push_subscriptions;
drop policy if exists push_subscriptions_admin_delete on public.push_subscriptions;
create policy push_subscriptions_admin_select on public.push_subscriptions
  for select to authenticated using (public.is_admin() and user_id = auth.uid());
create policy push_subscriptions_admin_insert on public.push_subscriptions
  for insert to authenticated with check (public.is_admin() and user_id = auth.uid());
create policy push_subscriptions_admin_delete on public.push_subscriptions
  for delete to authenticated using (public.is_admin() and user_id = auth.uid());
revoke all on public.push_subscriptions from anon;

-- 2) The secret key the database uses to call the send-push function (nobody can read this table from the website)
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  push_key text not null
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

-- 3) Sender used by the triggers. It can never block or break an order: any error is ignored.
create or replace function public.push_notify(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare k text;
begin
  select push_key into k from public.push_config where id = 1;
  if k is null then return; end if;
  perform net.http_post(
    url := 'https://hnidyltcxzjcenmxudll.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-key', k),
    body := p
  );
exception when others then
  null;
end $$;
revoke all on function public.push_notify(jsonb) from public, anon, authenticated;

-- 4) Customer submitted the UTR
create or replace function public.trg_push_utr()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notify(jsonb_build_object(
    'title', 'UTR aaya: ' || new.order_number,
    'body', 'Rs ' || new.total::text || ' - ' || new.full_name || '. Payment check karke confirm karo.',
    'url', '/admin/orders/' || new.id::text,
    'tag', 'utr-' || new.id::text));
  return null;
exception when others then
  return null;
end $$;
revoke all on function public.trg_push_utr() from public, anon, authenticated;
drop trigger if exists trg_orders_push_utr on public.orders;
create trigger trg_orders_push_utr after update of payment_reference on public.orders
  for each row when (old.payment_reference is null and new.payment_reference is not null)
  execute function public.trg_push_utr();

-- 5) A PAID order was cancelled (refund may be needed)
create or replace function public.trg_push_paid_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notify(jsonb_build_object(
    'title', 'Paid order cancel: ' || new.order_number,
    'body', 'Rs ' || new.total::text || ' - ' || new.full_name || '. Refund dena hai?',
    'url', '/admin/orders/' || new.id::text,
    'tag', 'cancel-' || new.id::text));
  return null;
exception when others then
  return null;
end $$;
revoke all on function public.trg_push_paid_cancel() from public, anon, authenticated;
drop trigger if exists trg_orders_push_paid_cancel on public.orders;
create trigger trg_orders_push_paid_cancel after update of status on public.orders
  for each row when (new.status = 'cancelled' and old.status <> 'cancelled' and old.payment_status = 'paid')
  execute function public.trg_push_paid_cancel();

-- 6) Stock of a colour just went below 5 (only when it CROSSES 5, so no repeated alerts)
create or replace function public.trg_push_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare pname text;
begin
  select name into pname from public.products where id = new.product_id;
  perform public.push_notify(jsonb_build_object(
    'title', case when new.stock_quantity <= 0 then 'Stock khatam' else 'Low stock: ' || new.stock_quantity::text || ' bache' end,
    'body', coalesce(pname, 'Product') || ' - ' || new.color || ' (' || new.sku || ')',
    'url', '/admin/products',
    'tag', 'stock-' || new.id::text));
  return null;
exception when others then
  return null;
end $$;
revoke all on function public.trg_push_low_stock() from public, anon, authenticated;
drop trigger if exists trg_variants_push_low_stock on public.product_variants;
create trigger trg_variants_push_low_stock after update of stock_quantity on public.product_variants
  for each row when (old.stock_quantity >= 5 and new.stock_quantity < 5 and new.active)
  execute function public.trg_push_low_stock();

-- pg_net must be on (it already is, the expired-order emails use it)
create extension if not exists pg_net;
