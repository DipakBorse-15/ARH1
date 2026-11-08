-- 0039: "Reset all orders" (admin tool) must not put stock back for SHIPPED orders (the goods have already left).
-- Same fix as 0038 (delete one order), now for the reset-all tool. Only this one line differs from the live function:
--   not in ('cancelled', 'delivered')  ->  not in ('cancelled', 'shipped', 'delivered')
-- Run once in Supabase -> SQL Editor. Safe to run again.

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
    where i.variant_id is not null and o.status not in ('cancelled', 'shipped', 'delivered')
    group by i.variant_id
  ) oi
  where v.id = oi.variant_id;

  delete from public.orders where true;
  update public.site_settings set stats_reset_at = now() where id = true;
end;
$$;

revoke all on function public.admin_reset_orders(text) from public, anon;
grant execute on function public.admin_reset_orders(text) to authenticated;
