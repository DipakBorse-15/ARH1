-- 0036: auto-cancel time for unpaid UPI orders (no UTR), India time:
--   ordered 7:00 AM - 6:00 PM  -> cancelled 3 hours after ordering
--   ordered 6:00 PM - 7:00 AM  -> cancelled at 10:00 AM (next morning, or same morning if ordered after midnight)
-- Run in Supabase SQL Editor. Safe to run more than once. The cron job stays as it is.

create or replace function public.unpaid_order_expiry(p_created timestamptz, p_hours integer default 3)
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select case
    when extract(hour from (p_created at time zone 'Asia/Kolkata')) >= 7
     and extract(hour from (p_created at time zone 'Asia/Kolkata')) < 18
      then p_created + make_interval(hours => p_hours)
    when extract(hour from (p_created at time zone 'Asia/Kolkata')) >= 18
      then (((p_created at time zone 'Asia/Kolkata')::date + 1) + time '10:00') at time zone 'Asia/Kolkata'
    else (((p_created at time zone 'Asia/Kolkata')::date) + time '10:00') at time zone 'Asia/Kolkata'
  end;
$$;

create or replace function public.expire_unpaid_orders(p_hours integer default 3)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  n integer;
begin
  update public.orders
  set status = 'cancelled', cancel_reason = 'expired'
  where payment_method = 'upi'
    and payment_status = 'pending'
    and status = 'pending'
    and payment_reference is null
    and public.unpaid_order_expiry(created_at, p_hours) < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_orders(integer) from public, anon, authenticated;

-- Quick check (no data changes): these 4 sample times should give
--   2 Nov 3:00 PM -> 2 Nov 6:00 PM | 2 Nov 8:00 PM -> 3 Nov 10:00 AM | 3 Nov 1:00 AM -> 3 Nov 10:00 AM | 2 Nov 6:30 AM -> 2 Nov 10:00 AM (all India time)
select t as ordered_at_ist,
       public.unpaid_order_expiry(t::timestamp at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata' as cancel_at_ist
from (values ('2026-11-02 15:00'), ('2026-11-02 20:00'), ('2026-11-03 01:00'), ('2026-11-02 06:30')) v(t);
