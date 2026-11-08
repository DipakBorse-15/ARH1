-- 0038: deleting an order must not put stock back for a SHIPPED order (the goods have already left).
-- Before: only cancelled / delivered orders were skipped, so deleting a shipped order made stock go up
-- for items the customer already has. Everything else in the function is unchanged (copied from 0022).
-- Run once in Supabase -> SQL Editor. Safe to run again.

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

  -- Only orders that are still holding stock (not cancelled, shipped or delivered) give it back.
  if v_status not in ('cancelled', 'shipped', 'delivered') then
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

revoke all on function public.admin_delete_order(uuid, text) from public, anon;
grant execute on function public.admin_delete_order(uuid, text) to authenticated;
