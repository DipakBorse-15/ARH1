-- =============================================================================
-- AARAAH.IN — 0037 (Batch-2): re-open a cancelled order, stricter UTR check, price must be > 0
-- Run once in Supabase SQL Editor (New query -> paste -> Run). Safe to run more than once.
-- At the end it shows ONE result row telling you if each part was applied.
-- =============================================================================

-- 1) Re-open a cancelled order (admin only) ------------------------------------
-- Why a function: the status guard (trg_orders_status_guard) does not let a cancelled
-- order change by itself. This function is owned by "postgres", so the guard's own
-- "manual fix" exception applies - but ONLY through this function, and only for an admin.
-- It sets the order to confirmed + paid; the stock trigger takes the stock again and
-- raises "Not enough stock to reopen this order" if the pieces were sold meanwhile
-- (then nothing changes).
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

  update public.orders
  set status = 'confirmed',
      payment_status = case when payment_method = 'cod' then payment_status else 'paid' end,
      cancel_reason = null
  where id = p_order_id;
end;
$$;

revoke all on function public.admin_reopen_order(uuid) from public, anon;
grant execute on function public.admin_reopen_order(uuid) to authenticated;

-- 2) Stricter UTR check ----------------------------------------------------------
-- Accepts a 12-digit UTR, OR a 12-35 character app transaction id (letters+digits, e.g.
-- PhonePe "T2311..."), which must contain at least 6 digits. Rejects the same character
-- repeated ("AAAAAAAA", "111111111111"). Nothing else in the function changes.
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
  if v_ref ~ '^(.)\1+$'
     or not (v_ref ~ '^[0-9]{12}$'
             or (v_ref ~ '^[A-Z0-9]{12,35}$' and length(regexp_replace(v_ref, '[^0-9]', '', 'g')) >= 6)) then
    raise exception 'Enter the 12-digit UTR / transaction number from your UPI app';
  end if;

  update public.orders
  set payment_reference = v_ref, payment_reference_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.submit_payment_reference(uuid, text) from public, anon;
grant execute on function public.submit_payment_reference(uuid, text) to authenticated;

-- 3) A colour's MRP must be above 0 (and a selling price, if given, above 0) ----------
-- Without this a blank/0 price (e.g. from an Excel import) would let anyone order for free.
-- If some rows already break the rule, the rule is NOT added (nothing else is affected):
-- the result row at the bottom says so; fix those prices and run this file again.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'product_variants_price_positive'
      and conrelid = 'public.product_variants'::regclass
  ) and not exists (
    select 1 from public.product_variants
    where price is null or price <= 0 or (sale_price is not null and sale_price <= 0)
  ) then
    alter table public.product_variants
      add constraint product_variants_price_positive
      check (price > 0 and (sale_price is null or sale_price > 0));
  end if;
end $$;

-- Result (one row) ----------------------------------------------------------------
select
  case when exists (select 1 from pg_proc where proname = 'admin_reopen_order') then 'OK' else 'MISSING' end as reopen_function,
  case when pg_get_functiondef('public.submit_payment_reference(uuid,text)'::regprocedure) like '%12-digit%' then 'OK' else 'OLD' end as utr_rule,
  case when exists (select 1 from pg_constraint where conname = 'product_variants_price_positive')
       then 'OK' else 'NOT ADDED - some variants have price/sale_price 0 or empty: select sku, price, sale_price from product_variants where price is null or price <= 0 or sale_price <= 0' end as price_rule;
