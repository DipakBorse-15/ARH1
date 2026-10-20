-- =============================================================================
-- AARAAH.IN — 0022: admin order delete (with code) + reset all orders
-- Run once in Supabase SQL Editor. Safe to run more than once.
-- =============================================================================

-- Dashboard "Total Customers" counts only customers who signed up after a reset.
alter table public.site_settings add column if not exists stats_reset_at timestamptz;

-- Delete ONE order. The caller must be an admin AND type the last 4 characters
-- of the order number (checked here on the server, not only in the browser).
create or replace function public.admin_delete_order(p_order_id uuid, p_code text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_number text;
  v_status text;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;

  select order_number, status into v_number, v_status from public.orders where id = p_order_id;
  if v_number is null then
    raise exception 'Order not found';
  end if;
  if p_code is null or p_code <> right(v_number, 4) then
    raise exception 'Wrong code';
  end if;

  -- Orders that are still holding stock (not cancelled, not delivered) give it back.
  if v_status not in ('cancelled', 'delivered') then
    update public.product_variants v
    set stock_quantity = v.stock_quantity + oi.qty,
        is_available = case when v.stock_quantity <= 0 then true else v.is_available end
    from (
      select variant_id, sum(quantity) as qty
      from public.order_items
      where order_id = p_order_id and variant_id is not null
      group by variant_id
    ) oi
    where v.id = oi.variant_id;
  end if;

  delete from public.orders where id = p_order_id; -- order_items go with it (cascade)
end;
$$;

-- Delete ALL orders and start the dashboard from zero.
create or replace function public.admin_reset_orders(p_confirm text)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  if p_confirm is distinct from 'RESET' then
    raise exception 'Type RESET to confirm';
  end if;

  update public.product_variants v
  set stock_quantity = v.stock_quantity + oi.qty,
      is_available = case when v.stock_quantity <= 0 then true else v.is_available end
  from (
    select i.variant_id, sum(i.quantity) as qty
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.variant_id is not null and o.status not in ('cancelled', 'delivered')
    group by i.variant_id
  ) oi
  where v.id = oi.variant_id;

  delete from public.orders where true;
  update public.site_settings set stats_reset_at = now() where id = true;
end;
$$;

revoke all on function public.admin_delete_order(uuid, text) from public, anon;
revoke all on function public.admin_reset_orders(text) from public, anon;
grant execute on function public.admin_delete_order(uuid, text) to authenticated;
grant execute on function public.admin_reset_orders(text) to authenticated;
