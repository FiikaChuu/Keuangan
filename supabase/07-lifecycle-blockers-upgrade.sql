-- Additive upgrade for installations with ORIGINAL 04/05 already applied.
-- Also safe after revised 04/05; does not open signup or reset receipts.
begin;
create table if not exists private.lifecycle_controls (
 singleton boolean primary key default true check(singleton),
 signup_enabled boolean not null default false
);
insert into private.lifecycle_controls(singleton) values(true) on conflict do nothing;
alter table private.lifecycle_controls enable row level security;
revoke all on private.lifecycle_controls from public,anon,authenticated,service_role;

create or replace function private.guard_signup() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email is null then raise exception 'Email diperlukan.' using errcode='42501'; end if;
  if exists(select 1 from private.allowed_users where email=lower(new.email) and not active) then
    raise exception 'Akses ditolak.' using errcode='42501';
  end if;
  if not exists(select 1 from private.allowed_users where email=lower(new.email) and active)
     and not coalesce((select signup_enabled from private.lifecycle_controls where singleton),false) then
    raise exception 'Pendaftaran ditutup.' using errcode='42501';
  end if;
  return new;
end $$;
create or replace function public.authorize_personal_reset(p_user_id uuid,p_request_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 perform pg_advisory_xact_lock(740261519);
 if p_request_id is null or not exists(select 1 from private.account_lifecycle where user_id=p_user_id and not deletion_pending) then
  raise exception 'Akses ditolak.' using errcode='42501'; end if;
 insert into private.personal_reset_requests(user_id,request_id) values(p_user_id,p_request_id) on conflict do nothing;
 -- Reauthentication can renew only an expired INCOMPLETE capability. Same finance
 -- lock serializes renewal with execution; completed receipts are immutable.
 update private.personal_reset_requests set ticket=gen_random_uuid(),created_at=clock_timestamp()
 where user_id=p_user_id and request_id=p_request_id and not completed
 and created_at < clock_timestamp()-interval '5 minutes';
 select ticket into t from private.personal_reset_requests where user_id=p_user_id and request_id=p_request_id;
 return t;
end $$;
revoke all on function public.authorize_personal_reset(uuid,uuid) from public,anon,authenticated;
grant execute on function public.authorize_personal_reset(uuid,uuid) to service_role;

commit;
