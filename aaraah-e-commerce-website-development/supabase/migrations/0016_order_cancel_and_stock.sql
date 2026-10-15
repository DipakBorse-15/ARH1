-- =============================================================================
-- AARAAH.IN — 0016: order-cancel stock sync + lock down decrement_variant_stock
-- Safe to run more than once.
-- =============================================================================

-- 1) decrement_variant_stock: only positive quantities
create or replace function public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Invalid quantity';
  end if;

  update public.product_variants
  set stock_quantity = stock_quantity - p_quantity,
      is_available = case when (stock_quantity - p_quantity) <= 0 then false else is_available end
  where id = p_variant_id
    and stock_quantity >= p_quantity; -- prevents negative stock under concurrency

  if not found then
    raise exception 'Insufficient stock for variant %', p_variant_id;
  end if;
end;
$$;

-- Only the server (service role, used by the create-order Edge Function) may call it.
-- NOTE: the old migration only revoked from anon/authenticated, but functions are
-- executable by PUBLIC by default, so anyone could still call it. Revoke PUBLIC too.
revoke execute on function public.decrement_variant_stock(uuid, integer) from public, anon, authenticated;
grant execute on function public.decrement_variant_stock(uuid, integer) to service_role;

-- 2) Stock follows the order status, whoever changes it (customer cancel,
--    admin panel, SQL):
--      -> cancelled           : stock of every order item goes back
--      cancelled -> anything  : stock is taken again (fails if not enough stock)
create or replace function public.orders_sync_stock_on_status()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_need int;
  v_done int;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v
    set stock_quantity = v.stock_quantity + oi.qty,
        is_available = case when v.stock_quantity <= 0 then true else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id;

  elsif old.status = 'cancelled' and new.status <> 'cancelled' then
    select count(distinct variant_id) into v_need
    from public.order_items
    where order_id = new.id and variant_id is not null;

    update public.product_variants v
    set stock_quantity = v.stock_quantity - oi.qty,
        is_available = case when (v.stock_quantity - oi.qty) <= 0 then false else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = new.id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id
      and v.stock_quantity >= oi.qty;

    get diagnostics v_done = row_count;
    if v_done < v_need then
      raise exception 'Not enough stock to reopen this order';
    end if;
  end if;

  return null;
end;
$$;

revoke all on function public.orders_sync_stock_on_status() from public, anon, authenticated;

drop trigger if exists trg_orders_sync_stock on public.orders;
create trigger trg_orders_sync_stock
  after update of status on public.orders
  for each row
  when (old.status is distinct from new.status)
  execute function public.orders_sync_stock_on_status();

-- 3) Customer cancel now goes through the cancel-order Edge Function (it also
--    sends the email), so the earlier helper RPC is no longer needed.
drop function if exists public.cancel_my_order(uuid);
