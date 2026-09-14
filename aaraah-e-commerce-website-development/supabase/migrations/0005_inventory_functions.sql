-- =============================================================================
-- AARAAH.IN — Safe, concurrency-friendly inventory helpers
-- =============================================================================

create or replace function public.decrement_variant_stock(p_variant_id uuid, p_quantity integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
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

-- Only server-side (service role, used by Edge Functions) should call this.
revoke execute on function public.decrement_variant_stock(uuid, integer) from anon, authenticated;
