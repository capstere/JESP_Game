-- Server-only accounting. No prompts or raw IP addresses.
create schema if not exists jesp_agent_private;
revoke all on schema jesp_agent_private from public, anon, authenticated;
grant usage on schema jesp_agent_private to service_role;
create table if not exists jesp_agent_private.quota (key text primary key, used integer not null default 0 check (used >= 0), expires_at timestamptz not null);
create table if not exists jesp_agent_private.leases (id uuid primary key default gen_random_uuid(), client_hash text not null, expires_at timestamptz not null);
alter table jesp_agent_private.quota enable row level security;
alter table jesp_agent_private.leases enable row level security;
revoke all on all tables in schema jesp_agent_private from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema jesp_agent_private to service_role;
create or replace function public.jesp_gateway_reserve(p_client text) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare t timestamptz := now(); item record; used_now integer; lease_id uuid;
begin
 if p_client !~ '^[a-f0-9]{64}$' then raise exception 'Invalid client hash'; end if;
 perform pg_advisory_xact_lock(64122368);
 delete from jesp_agent_private.quota where expires_at <= t;
 delete from jesp_agent_private.leases where expires_at <= t;
 if (select count(*) from jesp_agent_private.leases) >= 3 then return jsonb_build_object('allowed',false,'retry_after',20,'reason','concurrency'); end if;
 for item in select * from (values
 ('global-minute'::text,12,date_trunc('minute',t)+interval '1 minute'),
 ('global-hour',150,date_trunc('hour',t)+interval '1 hour'),
 ('global-day',1000,date_trunc('day',t)+interval '1 day'),
 ('global-month',10000,date_trunc('month',t)+interval '1 month'),
 ('client-hour:'||p_client,90,date_trunc('hour',t)+interval '1 hour')
 ) as limits(k,maximum,reset_at) loop
  select used into used_now from jesp_agent_private.quota where key=item.k;
  if coalesce(used_now,0) >= item.maximum then return jsonb_build_object('allowed',false,'retry_after',greatest(1,ceil(extract(epoch from (item.reset_at-t)))),'reason',split_part(item.k,':',1)); end if;
 end loop;
 for item in select * from (values
 ('global-minute'::text,date_trunc('minute',t)+interval '1 minute'),
 ('global-hour',date_trunc('hour',t)+interval '1 hour'),
 ('global-day',date_trunc('day',t)+interval '1 day'),
 ('global-month',date_trunc('month',t)+interval '1 month'),
 ('client-hour:'||p_client,date_trunc('hour',t)+interval '1 hour')
 ) as limits(k,reset_at) loop
  insert into jesp_agent_private.quota(key,used,expires_at) values(item.k,1,item.reset_at)
  on conflict(key) do update set used=jesp_agent_private.quota.used+1;
 end loop;
 insert into jesp_agent_private.leases(client_hash,expires_at) values(p_client,t+interval '140 seconds') returning id into lease_id;
 return jsonb_build_object('allowed',true,'lease',lease_id);
end;$$;
create or replace function public.jesp_gateway_release(p_lease uuid) returns void language sql security invoker set search_path = '' as $$ delete from jesp_agent_private.leases where id=p_lease; $$;
revoke all on function public.jesp_gateway_reserve(text) from public, anon, authenticated;
revoke all on function public.jesp_gateway_release(uuid) from public, anon, authenticated;
grant execute on function public.jesp_gateway_reserve(text) to service_role;
grant execute on function public.jesp_gateway_release(uuid) to service_role;
