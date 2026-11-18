-- Apply AFTER 01-schema.sql and 03-capacity.sql. Local-reviewed additive migration.
-- No ledger cascade; existing allowlist and household UUIDs are retained.
begin;
create table private.account_lifecycle (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid references public.households(id),
  deletion_pending boolean not null default false
);
alter table private.account_lifecycle enable row level security;
revoke all on private.account_lifecycle from public,anon,authenticated;
insert into private.account_lifecycle(user_id,household_id)
select u.id,a.household_id from auth.users u join private.allowed_users a on a.email=lower(u.email);

-- Server-owned signup control: deployment/UI flags cannot open Auth inserts.
create table private.lifecycle_controls (
 singleton boolean primary key default true check(singleton),
 signup_enabled boolean not null default false
);
insert into private.lifecycle_controls(singleton) values(true);
alter table private.lifecycle_controls enable row level security;
revoke all on private.lifecycle_controls from public,anon,authenticated,service_role;

-- Email eligibility is retained for legacy accounts, but identity and tenant mapping
-- are server-owned UUID rows. User-editable metadata is deliberately never read.
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
create function private.provision_tenant() returns trigger
language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
  if exists(select 1 from auth.users u where lower(u.email)=lower(new.email) and u.id<>new.id) then
    raise exception 'Akses ditolak.' using errcode='42501';
  end if;
  select household_id into h from private.allowed_users where email=lower(new.email) and active;
  if not found then
    insert into public.households(name) values('Ruang pribadi') returning id into h;
    insert into private.allowed_users(email,household_id) values(lower(new.email),h);
  end if;
  insert into private.account_lifecycle(user_id,household_id) values(new.id,h);
  if h is not null then insert into public.household_members values(h,new.id); end if;
  return new;
end $$;
create trigger skywallet_provision_tenant after insert on auth.users for each row execute function private.provision_tenant();
create or replace function private.is_allowed() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users u
 join private.account_lifecycle l on l.user_id=u.id
 join private.allowed_users a on a.email=lower(u.email)
 where u.id=auth.uid() and u.email_confirmed_at is not null and a.active
 and not l.deletion_pending and a.household_id is not distinct from l.household_id);
$$;
create or replace function private.can_access_wallet(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.is_allowed() and exists(select 1 from public.wallets w where w.id=p_id and
 ((w.household_id is null and w.owner_id=auth.uid()) or exists(
 select 1 from private.account_lifecycle l join public.household_members m
 on m.user_id=l.user_id and m.household_id=l.household_id
 where l.user_id=auth.uid() and l.household_id=w.household_id and not l.deletion_pending)));
$$;
create or replace function public.bootstrap_finance() returns void
language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
 perform pg_advisory_xact_lock(740261519);
 if not private.is_allowed() then raise exception 'Akses ditolak.' using errcode='42501'; end if;
 select household_id into h from private.account_lifecycle where user_id=auth.uid();
 if h is not null then insert into public.household_members values(h,auth.uid()) on conflict do nothing; end if;
 insert into public.plans(user_id) values(auth.uid()) on conflict do nothing;
end $$;

-- Keep the proven ledger engine, put the fail-closed gate before its lock/check.
alter function public.commit_finance(uuid,jsonb) rename to commit_finance_legacy;
alter function public.commit_finance_legacy(uuid,jsonb) set schema private;
revoke all on function private.commit_finance_legacy(uuid,jsonb) from public,anon,authenticated;
create function public.commit_finance(p_request_id uuid,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare op jsonb; w public.wallets;
begin
 perform pg_advisory_xact_lock(740261519);
 if not private.is_allowed() then raise exception 'Akses ditolak.' using errcode='42501'; end if;
 if exists(select 1 from private.mutation_requests where user_id=auth.uid() and request_id=p_request_id) then
   perform private.commit_finance_legacy(p_request_id,p_changes);
   return;
 end if;
 for op in select value from jsonb_array_elements(p_changes) where value->>'type'='wallet.delete' loop
   select * into w from public.wallets where id=(op->>'id')::uuid;
   if not found or w.owner_id<>auth.uid() or not private.can_access_wallet(w.id) then
     raise exception 'Dompet tidak dapat dihapus.' using errcode='42501';
   end if;
   if exists(select 1 from public.transactions where from_wallet_id=w.id or to_wallet_id=w.id)
      or exists(select 1 from public.goals where wallet_id=w.id) then
     raise exception 'Dompet memiliki riwayat transaksi atau tujuan. Penghapusan diblokir untuk melindungi catatan.' using errcode='23503';
   end if;
   if w.balance<>0 or w.opening_balance<>0 then
     raise exception 'Hanya dompet kosong tanpa saldo yang dapat dihapus.' using errcode='23503';
   end if;
 end loop;
 perform private.commit_finance_legacy(p_request_id,p_changes);
end $$;
revoke all on function public.commit_finance(uuid,jsonb) from public,anon;
grant execute on function public.commit_finance(uuid,jsonb) to authenticated;

-- Only the server service role may call this. This is NOT a client deletion RPC.
-- Leave pending=true on any downstream Auth failure; retry is intentionally idempotent.
create function public.prepare_self_delete(p_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(740261519);
 if not exists(select 1 from private.account_lifecycle where user_id=p_user_id) then
   raise exception 'Akun tidak tersedia.' using errcode='42501';
 end if;
 if exists(select 1 from public.wallets where owner_id=p_user_id)
 or exists(select 1 from public.transactions where created_by=p_user_id)
 or exists(select 1 from public.household_members mine join public.household_members other
 on other.household_id=mine.household_id and other.user_id<>mine.user_id where mine.user_id=p_user_id) then
   raise exception 'Akun memiliki dompet, riwayat, atau keanggotaan bersama. Penghapusan diblokir; catatan keuangan tidak dihapus otomatis.' using errcode='23503';
 end if;
 update private.account_lifecycle set deletion_pending=true where user_id=p_user_id;
 -- Tombstone the email mapping too: re-signup must never inherit an abandoned tenant.
 update private.allowed_users set active=false where email in (select lower(email) from auth.users where id=p_user_id);
end $$;
revoke all on function public.prepare_self_delete(uuid) from public,anon,authenticated;
grant execute on function public.prepare_self_delete(uuid) to service_role;
revoke all on function private.provision_tenant() from public,anon,authenticated;
-- Include server identity for ownership hints; never use the hint for authorization.
create or replace function public.finance_snapshot() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('allowed',private.is_allowed(),'user_id',auth.uid(),
 'revision',public.finance_revision()->>'revision',
 'wallets',coalesce((select jsonb_agg(w order by w.created_at) from public.wallets w),'[]'::jsonb),
 'transactions',coalesce((select jsonb_agg(t order by t.date desc,t.id) from public.transactions t),'[]'::jsonb),
 'goals',coalesce((select jsonb_agg(g) from public.goals g),'[]'::jsonb),
 'plan',(select to_jsonb(p) from public.plans p where p.user_id=auth.uid()));
$$;
commit;
