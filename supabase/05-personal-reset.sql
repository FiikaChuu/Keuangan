-- LOCAL ONLY: apply after 04. Review/stage before release; no Auth deletion.
begin;
alter table private.account_lifecycle add column reset_after timestamptz;
create table private.personal_reset_requests (
 user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
 ticket uuid not null default gen_random_uuid(), revision text, completed boolean not null default false,
 created_at timestamptz not null default clock_timestamp(), primary key(user_id,request_id)
);
alter table private.personal_reset_requests enable row level security;
revoke all on private.personal_reset_requests from public,anon,authenticated;
-- A service-issued capability is bound to verified identity; never returned to the browser.
create function public.authorize_personal_reset(p_user_id uuid,p_request_id uuid) returns uuid
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

-- Fence already-issued JWTs after reset. Existing lifecycle gate still applies.
create function private.check_reset_epoch() returns void language plpgsql security definer set search_path='' as $$
declare fence timestamptz; issued numeric;
begin
 select reset_after into fence from private.account_lifecycle where user_id=auth.uid();
 if fence is not null then
  issued := coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'iat','0')::numeric;
  if issued < ceil(extract(epoch from fence)) then
   raise exception 'Sesi sebelum reset. Masuk kembali.' using errcode='42501'; end if;
 end if;
end $$;
revoke all on function private.check_reset_epoch() from public,anon,authenticated;
alter function public.commit_finance(uuid,jsonb) rename to commit_finance_lifecycle;
alter function public.commit_finance_lifecycle(uuid,jsonb) set schema private;
revoke all on function private.commit_finance_lifecycle(uuid,jsonb) from public,anon,authenticated;
create function public.commit_finance(p_request_id uuid,p_changes jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(740261519);
 perform private.check_reset_epoch();
 perform private.commit_finance_lifecycle(p_request_id,p_changes);
end $$;
revoke all on function public.commit_finance(uuid,jsonb) from public,anon;
grant execute on function public.commit_finance(uuid,jsonb) to authenticated;
alter function public.bootstrap_finance() rename to bootstrap_finance_lifecycle;
alter function public.bootstrap_finance_lifecycle() set schema private;
revoke all on function private.bootstrap_finance_lifecycle() from public,anon,authenticated;
create function public.bootstrap_finance() returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(740261519);
 perform private.check_reset_epoch();
 perform private.bootstrap_finance_lifecycle();
end $$;
revoke all on function public.bootstrap_finance() from public,anon;
grant execute on function public.bootstrap_finance() to authenticated;

-- Internal scope marker: cannot be forged with a client-set GUC. Only the reset RPC
-- populates it; transaction rollback removes it. Shared ledger trigger never skips.
create table private.personal_reset_scope(wallet_id uuid primary key);
revoke all on private.personal_reset_scope from public,anon,authenticated;
alter table private.personal_reset_scope enable row level security;
-- Do not suppress the DELETE itself: the original AFTER ledger trigger is wrapped.
alter function private.apply_ledger_delta() rename to apply_ledger_delta_before_reset;
create function private.apply_ledger_delta() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='DELETE' and exists(select 1 from private.personal_reset_scope where wallet_id=old.from_wallet_id)
 and (old.to_wallet_id is null or exists(select 1 from private.personal_reset_scope where wallet_id=old.to_wallet_id)) then return null; end if;
 -- Original trigger cannot be invoked as an ordinary function; reproduce its net delta.
 declare o public.transactions; n public.transactions; r record;
 begin
 if tg_op<>'INSERT' then o:=old; end if;
 if tg_op<>'DELETE' then n:=new; end if;
 for r in select wallet_id,sum(delta)::bigint delta from (values
 (o.from_wallet_id,case when o.kind='income' then -o.amount else o.amount+o.fee end),
 (o.to_wallet_id,-o.amount),(n.from_wallet_id,case when n.kind='income' then n.amount else -n.amount-n.fee end),
 (n.to_wallet_id,n.amount)) v(wallet_id,delta) where wallet_id is not null group by wallet_id order by wallet_id loop
 update public.wallets set balance=balance+r.delta,version=version+1 where id=r.wallet_id and balance+r.delta between 0 and 9000000000000;
 if not found then raise exception 'Saldo tidak cukup.' using errcode='22003'; end if;
 end loop;
 end;
 return null;
end $$;
drop trigger update_ledger on public.transactions;
create trigger update_ledger after insert or update or delete on public.transactions for each row execute function private.apply_ledger_delta();
revoke all on function private.apply_ledger_delta() from public,anon,authenticated;

create function public.reset_personal_finance(p_request_id uuid,p_revision text,p_ticket uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r private.personal_reset_requests; actual text; ids uuid[];
begin
 perform pg_advisory_xact_lock(740261519);
 if not private.is_allowed() then raise exception 'Akses ditolak.' using errcode='42501'; end if;
 select * into r from private.personal_reset_requests where user_id=auth.uid() and request_id=p_request_id and ticket=p_ticket for update;
 if not found then raise exception 'Verifikasi diperlukan.' using errcode='42501'; end if;
 if r.completed then
  if r.revision is distinct from p_revision then raise exception 'ID permintaan berbeda.' using errcode='22023'; end if;
  return jsonb_build_object('reset',true,'replayed',true);
 end if;
 if r.created_at < clock_timestamp()-interval '5 minutes' then raise exception 'Verifikasi kedaluwarsa.' using errcode='42501'; end if;
 perform private.check_reset_epoch();
 -- Explicitly scoped revision, identical to RLS finance_revision for this user.
 select md5(coalesce((select string_agg(id::text||':'||version::text,',' order by id) from public.wallets where private.can_access_wallet(id)),'')||'|'||
 coalesce((select string_agg(g.id::text||':'||g.version::text,',' order by g.id) from public.goals g where private.can_access_wallet(g.wallet_id)),'')||'|'||
 coalesce((select version::text from public.plans where user_id=auth.uid()),'')) into actual;
 if p_revision is distinct from actual then raise exception 'Data berubah. Muat ulang.' using errcode='40001'; end if;
 select coalesce(array_agg(id),'{}'::uuid[]) into ids from public.wallets where owner_id=auth.uid() and household_id is null;
 -- Never touch ANY other endpoint, including another user's private wallet.
 if exists(select 1 from public.transactions where (from_wallet_id=any(ids) or to_wallet_id=any(ids))
 and (not(from_wallet_id=any(ids)) or (to_wallet_id is not null and not(to_wallet_id=any(ids))))) then
  raise exception 'Dompet pribadi terhubung data bersama atau pengguna lain. Reset diblokir.' using errcode='23503'; end if;
 insert into private.personal_reset_scope select unnest(ids);
 delete from public.goals where wallet_id=any(ids);
 delete from public.transactions where from_wallet_id=any(ids);
 delete from public.wallets where id=any(ids);
 delete from public.plans where user_id=auth.uid();
 delete from private.personal_reset_scope where wallet_id=any(ids);
 update private.account_lifecycle set reset_after=clock_timestamp() where user_id=auth.uid();
 update private.personal_reset_requests set completed=true,revision=p_revision where user_id=auth.uid() and request_id=p_request_id;
 return jsonb_build_object('reset',true,'replayed',false);
end $$;
revoke all on function public.reset_personal_finance(uuid,text,uuid) from public,anon;
grant execute on function public.reset_personal_finance(uuid,text,uuid) to authenticated;
commit;
