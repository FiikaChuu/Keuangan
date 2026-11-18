-- Local-reviewed SQL-editor migration, after 05. No external rate-limit service.
begin;
create table private.lifecycle_reauth_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_started timestamptz not null,
 attempts integer not null check(attempts between 1 and 5),
 lease uuid,
 lease_until timestamptz
);
alter table private.lifecycle_reauth_limits enable row level security;
revoke all on private.lifecycle_reauth_limits from public,anon,authenticated,service_role;
-- One shared budget for reset AND delete: 5 attempts / 15 minutes, 1 in flight.
-- Row locks serialize all server instances; denied calls never extend the window.
create function public.acquire_lifecycle_reauth(p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare r private.lifecycle_reauth_limits; t uuid; n timestamptz := clock_timestamp();
begin
 if p_user_id is null or not exists(select 1 from auth.users where id=p_user_id) then return null; end if;
 insert into private.lifecycle_reauth_limits(user_id,window_started,attempts)
 values(p_user_id,n,1) on conflict do nothing;
 select * into r from private.lifecycle_reauth_limits where user_id=p_user_id for update;
 n := clock_timestamp(); -- evaluate deadlines AFTER any competing transaction lock wait
 -- Fresh row has no lease; subsequent releases retain the last (expired) deadline.
 if r.lease_until > n then return null; end if;
 if r.window_started <= n-interval '15 minutes' then
   r.attempts := 1; r.window_started := n;
 elsif r.lease_until is not null then
   if r.attempts >= 5 then return null; end if;
   r.attempts := r.attempts+1;
 end if;
 t := gen_random_uuid();
 update private.lifecycle_reauth_limits set window_started=r.window_started,attempts=r.attempts,
 lease=t,lease_until=n+interval '2 minutes' where user_id=p_user_id;
 return t;
end $$;
create function public.release_lifecycle_reauth(p_user_id uuid,p_lease uuid) returns void
language sql security definer set search_path='' as $$
 update private.lifecycle_reauth_limits set lease=null,lease_until=clock_timestamp()
 where user_id=p_user_id and lease=p_lease;
$$;
revoke all on function public.acquire_lifecycle_reauth(uuid) from public,anon,authenticated;
revoke all on function public.release_lifecycle_reauth(uuid,uuid) from public,anon,authenticated;
grant execute on function public.acquire_lifecycle_reauth(uuid) to service_role;
grant execute on function public.release_lifecycle_reauth(uuid,uuid) to service_role;
commit;
