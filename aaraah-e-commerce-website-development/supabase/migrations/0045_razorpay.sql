-- =============================================================================
-- AARAAH.IN — 0045: Razorpay online payment (UPI / cards / netbanking / wallets)
-- Run once in Supabase SQL Editor (New query -> paste -> Run). Safe to run more than once.
-- It only ADDS things: old UPI+UTR orders keep working exactly as before.
-- At the end it shows ONE result row telling you if each part was applied.
-- =============================================================================

-- 1) New columns on orders ------------------------------------------------------
alter table public.orders add column if not exists razorpay_order_id text;
alter table public.orders add column if not exists razorpay_payment_id text;
alter table public.orders add column if not exists paid_at timestamptz;
-- "Buy Now" order (not bought from the cart): the cart must stay untouched when the payment arrives.
alter table public.orders add column if not exists buy_now boolean not null default false;

create unique index if not exists orders_razorpay_order_id_key
  on public.orders (razorpay_order_id) where razorpay_order_id is not null;
create unique index if not exists orders_razorpay_payment_id_key
  on public.orders (razorpay_payment_id) where razorpay_payment_id is not null;

-- 2) Mark an order paid (called ONLY by the razorpay-payment Edge Function, with the service key) ----
-- Returns one word:
--   paid               pending order -> confirmed + paid
--   reopened           the order had been auto-cancelled (30 min over) but the money did arrive:
--                      it is re-opened (stock is taken again by the stock trigger) -> confirmed + paid
--   already            same payment was already recorded (browser + webhook both arrive: normal)
--   no_stock           cancelled order and the stock is gone meanwhile -> nothing changed, the function refunds
--   duplicate_payment  the order is already paid / refunded by another payment -> the function refunds this extra one
--   missing            order id not found
-- It is "security definer" (owner postgres) so the status guard's manual-fix exception applies,
-- the same way admin_reopen_order works.
create or replace function public.razorpay_mark_paid(p_order_id uuid, p_payment_id text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v public.orders%rowtype;
begin
  select * into v from public.orders where id = p_order_id for update;
  if not found then
    return 'missing';
  end if;

  if v.payment_status in ('paid', 'refunded') then
    if v.razorpay_payment_id is not distinct from p_payment_id then
      return 'already';
    end if;
    return 'duplicate_payment';
  end if;

  if v.status = 'cancelled' then
    begin
      update public.orders
      set status = 'confirmed',
          payment_status = 'paid',
          razorpay_payment_id = p_payment_id,
          paid_at = now(),
          cancel_reason = null
      where id = p_order_id;
    exception when raise_exception then
      -- "Not enough stock to reopen this order": the whole update is rolled back
      return 'no_stock';
    end;
    return 'reopened';
  end if;

  update public.orders
  set status = case when status = 'pending' then 'confirmed' else status end,
      payment_status = 'paid',
      razorpay_payment_id = p_payment_id,
      paid_at = now()
  where id = p_order_id;
  return 'paid';
end;
$$;

revoke all on function public.razorpay_mark_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.razorpay_mark_paid(uuid, text) to service_role;

-- 3) Unpaid Razorpay orders: cancel after 30 minutes (stock goes back by the existing stock trigger) ----
-- cancel_reason = 'abandoned' on purpose: the old "expired" e-mail job (send-expired-emails) only
-- mails UPI orders, so a customer who simply closed the payment window gets no extra mail.
create or replace function public.expire_razorpay_orders(p_minutes integer default 30)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  update public.orders
  set status = 'cancelled', cancel_reason = 'abandoned'
  where payment_method = 'razorpay'
    and payment_status = 'pending'
    and status = 'pending'
    and created_at < now() - make_interval(mins => p_minutes);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_razorpay_orders(integer) from public, anon, authenticated;

-- The admin button "Cancel expired orders" now handles both kinds.
create or replace function public.admin_expire_unpaid_orders()
returns integer
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return public.expire_unpaid_orders(3) + public.expire_razorpay_orders(30);
end;
$$;

revoke all on function public.admin_expire_unpaid_orders() from public, anon;
grant execute on function public.admin_expire_unpaid_orders() to authenticated;

-- Re-open by hand (admin): same as 0037, plus: an online order whose money never came cannot be re-opened.
-- (If the customer pays late, razorpay_mark_paid re-opens the order by itself.)
create or replace function public.admin_reopen_order(p_order_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'cancelled' then
    raise exception 'Only a cancelled order can be re-opened';
  end if;
  if v_order.shipped_at is not null then
    raise exception 'A shipped order cannot be re-opened';
  end if;
  if v_order.payment_status = 'refunded' then
    raise exception 'A refunded order cannot be re-opened';
  end if;
  if v_order.payment_method = 'razorpay' and v_order.payment_status <> 'paid' then
    raise exception 'The online payment for this order was not received, so it cannot be re-opened';
  end if;

  update public.orders
  set status = 'confirmed',
      payment_status = case when payment_method = 'cod' then payment_status else 'paid' end,
      cancel_reason = null
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_reopen_order(uuid) from public, anon;
grant execute on function public.admin_reopen_order(uuid) to authenticated;

-- Every 5 minutes (a cheap query), so an unpaid order is cancelled 30-35 minutes after it was placed.
-- The old UPI job (every 15 minutes) is not touched.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled: %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('aaraah-expire-razorpay-orders');
    exception when others then
      null;
    end;
    perform cron.schedule('aaraah-expire-razorpay-orders', '*/5 * * * *', 'select public.expire_razorpay_orders(30)');
  end if;
end $$;

-- Result (one row) ----------------------------------------------------------------
select
  case when exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'razorpay_order_id')
        and exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'buy_now')
       then 'OK' else 'MISSING' end as columns_added,
  case when exists (select 1 from pg_proc where proname = 'razorpay_mark_paid') then 'OK' else 'MISSING' end as mark_paid_function,
  case when exists (select 1 from pg_proc where proname = 'expire_razorpay_orders') then 'OK' else 'MISSING' end as expiry_function,
  case when exists (select 1 from cron.job where jobname = 'aaraah-expire-razorpay-orders') then 'OK' else 'NOT SCHEDULED (admin button still works)' end as cron_job;
