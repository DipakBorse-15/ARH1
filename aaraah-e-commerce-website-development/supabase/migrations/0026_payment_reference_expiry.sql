-- =============================================================================
-- AARAAH.IN — 0026: UTR box, auto-expiry of unpaid UPI orders, safer order owner link
-- Run once in Supabase SQL Editor. Safe to run more than once.
-- =============================================================================

-- 1) The customer's UPI reference (UTR) for an order ---------------------------
alter table public.orders add column if not exists payment_reference text;
alter table public.orders add column if not exists payment_reference_at timestamptz;

-- Customers cannot update orders directly (only admin can), so they submit the UTR
-- through this function. It only touches their OWN order and only these two columns.
create or replace function public.submit_payment_reference(p_order_id uuid, p_reference text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ref text := upper(regexp_replace(coalesce(p_reference, ''), '\s', '', 'g'));
  v_order public.orders%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Please sign in first';
  end if;

  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid();
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.payment_method <> 'upi' or v_order.payment_status = 'paid' then
    raise exception 'Payment for this order is already received';
  end if;
  if v_ref !~ '^[A-Z0-9]{8,30}$' then
    raise exception 'Enter the UTR / transaction number from your UPI app (usually 12 digits)';
  end if;

  update public.orders
  set payment_reference = v_ref, payment_reference_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.submit_payment_reference(uuid, text) from public, anon;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

-- 2) Unpaid UPI orders stop holding stock after 3 hours -------------------------
-- Cancels pending UPI orders that are still unpaid AND where the customer has not
-- sent a UTR. The existing stock trigger puts the stock back on cancel.
create or replace function public.expire_unpaid_orders(p_hours integer default 3)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  update public.orders
  set status = 'cancelled'
  where payment_method = 'upi'
    and payment_status = 'pending'
    and status = 'pending'
    and payment_reference is null
    and created_at < now() - make_interval(hours => p_hours);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_orders(integer) from public, anon, authenticated;

-- Button for the admin panel ("Cancel expired orders").
create or replace function public.admin_expire_unpaid_orders()
returns integer
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return public.expire_unpaid_orders(3);
end;
$$;

revoke all on function public.admin_expire_unpaid_orders() from public, anon;
grant execute on function public.admin_expire_unpaid_orders() to authenticated;

-- Run it automatically every 15 minutes (needs the pg_cron extension; if it cannot be
-- enabled here, the admin button above still works and nothing else breaks).
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled: %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('aaraah-expire-unpaid-orders');
    exception when others then
      null;
    end;
    perform cron.schedule('aaraah-expire-unpaid-orders', '*/15 * * * *', 'select public.expire_unpaid_orders(3)');
  end if;
end $$;

-- 3) Deleting a login must not delete the shop's order history ------------------
alter table public.orders drop constraint if exists orders_user_id_fkey;
alter table public.orders
  add constraint orders_user_id_fkey foreign key (user_id) references auth.users (id) on delete restrict;
