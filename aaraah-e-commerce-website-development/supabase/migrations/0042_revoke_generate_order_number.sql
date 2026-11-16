-- 0042: only the create-order Edge Function (service role) may take an order number.
-- Before this, anyone could call generate_order_number() from outside and use up order numbers.
-- Safe to run more than once.
revoke execute on function public.generate_order_number() from public, anon, authenticated;
grant execute on function public.generate_order_number() to service_role;
