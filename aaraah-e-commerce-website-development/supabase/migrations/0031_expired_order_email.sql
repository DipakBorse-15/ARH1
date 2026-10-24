-- 0031: customers get an email when an unpaid UPI order is auto-cancelled (after 3 hours).
-- Run in Supabase SQL Editor. Safe to run more than once.
-- Deploy the Edge Function `send-expired-emails` too (see its file for the steps).

alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists cancel_email_sent_at timestamptz;

-- Same as before (0026), but it now marks WHY the order was cancelled, so the email job can find it.
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
    and created_at < now() - make_interval(hours => p_hours);
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.expire_unpaid_orders(integer) from public, anon, authenticated;

-- Every 15 minutes (5 minutes after the cancel job) ask the Edge Function to email the customers.
-- Needs pg_cron and pg_net; if either cannot be enabled here, nothing else breaks.
do $$
begin
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron could not be enabled: %', sqlerrm;
  end;
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net could not be enabled: %', sqlerrm;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    begin
      perform cron.unschedule('aaraah-expired-order-emails');
    exception when others then
      null;
    end;
    perform cron.schedule(
      'aaraah-expired-order-emails',
      '5,20,35,50 * * * *',
      $job$select net.http_post(
        url := 'https://hnidyltcxzjcenmxudll.supabase.co/functions/v1/send-expired-emails',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      )$job$
    );
  end if;
end $$;

-- Check: both jobs should be listed (if this errors, pg_cron is not enabled)
select jobname, schedule, active from cron.job where jobname like 'aaraah-%';
