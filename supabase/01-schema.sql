-- SkyWallet. Run once in Supabase > SQL Editor, before inviting users.
-- All money is integer rupiah. Images and OCR input are NEVER stored here.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100)
);
insert into public.households(id, name)
values ('0f739560-0427-4dca-8247-9e2f885d5191', 'Akun bersama');

create table private.allowed_users (
  email text primary key check (email = lower(trim(email))),
  household_id uuid references public.households(id),
  active boolean not null default true
);
create table public.household_members (
  household_id uuid not null references public.households(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (household_id, user_id)
);
create table public.wallets (
  id uuid primary key,
  owner_id uuid not null references auth.users(id),
  household_id uuid references public.households(id),
  name text not null check (char_length(trim(name)) between 1 and 100),
  provider text not null check (char_length(provider) between 1 and 80),
  color text not null default '#1D2949' check (color ~ '^#[0-9a-fA-F]{6}$'),
  suffix text not null default '' check (suffix ~ '^[0-9]{0,4}$'),
  opening_balance bigint not null check (opening_balance between 0 and 1000000000000),
  balance bigint not null check (balance between 0 and 9000000000000),
  version bigint not null default 1,
  created_at timestamptz not null default now()
);
create index wallets_owner_idx on public.wallets(owner_id) where household_id is null;
create index wallets_household_idx on public.wallets(household_id) where household_id is not null;

create table public.transactions (
  id uuid primary key,
  created_by uuid not null references auth.users(id),
  kind text not null check (kind in ('income','expense','transfer')),
  category text not null check (category in ('Makan','Belanja','Pendidikan','Transportasi','Tagihan','Transfer','Lainnya','Pemasukan')),
  title text generated always as (category) stored,
  amount bigint not null check (amount between 1 and 1000000000000),
  fee bigint not null default 0 check (fee between 0 and 1000000000),
  date date not null,
  from_wallet_id uuid not null references public.wallets(id),
  to_wallet_id uuid references public.wallets(id),
  source text not null default '' check (char_length(source) <= 500),
  catatan text check (char_length(catatan) <= 2200),
  reference text check (char_length(reference) between 1 and 100),
  receipt_hash bytea check (octet_length(receipt_hash) = 32),
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  check ((kind = 'transfer' and category = 'Transfer' and to_wallet_id is not null and to_wallet_id <> from_wallet_id)
      or (kind = 'expense' and category not in ('Transfer','Pemasukan') and to_wallet_id is null)
      or (kind = 'income' and category = 'Pemasukan' and fee = 0 and to_wallet_id is null and char_length(trim(source)) > 0))
);
create index transactions_from_date_idx on public.transactions(from_wallet_id, date desc, id);
create index transactions_to_date_idx on public.transactions(to_wallet_id, date desc, id) where to_wallet_id is not null;
create unique index transactions_reference_idx on public.transactions(from_wallet_id, lower(reference)) where reference is not null;
create unique index transactions_hash_idx on public.transactions(from_wallet_id, receipt_hash) where receipt_hash is not null;

create table public.goals (
  id uuid primary key,
  wallet_id uuid not null unique references public.wallets(id),
  name text not null check (char_length(trim(name)) between 1 and 100),
  target bigint not null check (target between 1 and 1000000000000),
  emoji text not null default '🌱' check (char_length(emoji) <= 12),
  version bigint not null default 1
);
create table public.plans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  reserve bigint not null default 0 check (reserve between 0 and 1000000000000),
  saving smallint not null default 50 check (saving between 0 and 100),
  fun smallint not null default 30 check (fun between 0 and 100),
  together smallint not null default 20 check (together between 0 and 100),
  version bigint not null default 1,
  check (saving + fun + together = 100)
);
create table private.mutation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  fingerprint bytea not null,
  created_at timestamptz not null default now(),
  primary key(user_id, request_id)
);
create table private.scan_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null,
  bucket timestamptz not null,
  count integer not null,
  primary key(user_id, period, bucket)
);

create function private.is_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join private.allowed_users a on a.email = lower(u.email)
    where u.id = auth.uid() and a.active and u.email_confirmed_at is not null);
$$;
create function private.can_access_wallet(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_allowed() and exists(select 1 from public.wallets w where w.id = p_id and
    ((w.household_id is null and w.owner_id = auth.uid()) or exists(
      select 1 from public.household_members m join private.allowed_users a on a.household_id = m.household_id
        join auth.users u on u.id = m.user_id and lower(u.email) = a.email
      where m.household_id = w.household_id and m.user_id = auth.uid() and a.active)));
$$;
create function private.guard_signup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from private.allowed_users where email = lower(new.email) and active) then
    raise exception 'Email tidak diizinkan.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger skywallet_guard_signup before insert on auth.users for each row execute function private.guard_signup();

create function public.bootstrap_finance() returns void
language plpgsql security definer set search_path = '' as $$
declare v_household uuid;
begin
  if not private.is_allowed() then raise exception 'Akses ditolak. Hubungi pemilik aplikasi.' using errcode = '42501'; end if;
  select a.household_id into v_household from private.allowed_users a join auth.users u on lower(u.email) = a.email where u.id = auth.uid();
  delete from public.household_members where user_id = auth.uid() and household_id is distinct from v_household;
  if v_household is not null then insert into public.household_members values(v_household, auth.uid()) on conflict do nothing; end if;
  insert into public.plans(user_id) values(auth.uid()) on conflict do nothing;
end;
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;
alter table public.plans enable row level security;
create policy read_membership on public.household_members for select to authenticated
  using (user_id = auth.uid() and private.is_allowed());
create policy read_household on public.households for select to authenticated using (
  private.is_allowed() and exists(select 1 from public.household_members m where m.household_id = id and m.user_id = auth.uid()));
create policy read_wallet on public.wallets for select to authenticated using (private.can_access_wallet(id));
create policy read_transaction on public.transactions for select to authenticated using (
  private.can_access_wallet(from_wallet_id) or private.can_access_wallet(to_wallet_id));
create policy read_goal on public.goals for select to authenticated using (private.can_access_wallet(wallet_id));
create policy read_plan on public.plans for select to authenticated using (user_id = auth.uid() and private.is_allowed());
revoke all on public.households, public.household_members, public.wallets, public.transactions, public.goals, public.plans from anon, authenticated;
grant select on public.households, public.household_members, public.wallets, public.transactions, public.goals, public.plans to authenticated;

-- Defense in depth: every ledger change applies its NET effect to both wallets.
-- Raising an exception rolls back the complete RPC, including the first debit.
create function private.apply_ledger_delta() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.transactions; n public.transactions; r record;
begin
  if tg_op <> 'INSERT' then o := old; end if;
  if tg_op <> 'DELETE' then n := new; end if;
  for r in
    select wallet_id, sum(delta)::bigint delta from (values
      (o.from_wallet_id, case when o.kind = 'income' then -o.amount else o.amount + o.fee end),
      (o.to_wallet_id, -o.amount),
      (n.from_wallet_id, case when n.kind = 'income' then n.amount else -n.amount - n.fee end),
      (n.to_wallet_id, n.amount)
    ) v(wallet_id,delta) where wallet_id is not null group by wallet_id order by wallet_id
  loop
    update public.wallets set balance = balance + r.delta, version = version + 1
      where id = r.wallet_id and balance + r.delta between 0 and 9000000000000;
    if not found then raise exception 'Saldo tidak cukup atau melewati batas. Transaksi dibatalkan.' using errcode = '22003'; end if;
  end loop;
  return null;
end;
$$;
create trigger update_ledger after insert or update or delete on public.transactions for each row execute function private.apply_ledger_delta();

-- One database transaction per RPC. The short lock serializes the two-user ledger;
-- client clicks, devices and retries cannot interleave debit and credit.
create function public.commit_finance(p_request_id uuid, p_changes jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  op jsonb; d jsonb; v_id uuid; v_version bigint; v_household uuid; v_kind text; v_category text;
  w public.wallets; t public.transactions; g public.goals; v_fingerprint bytea; v_existing bytea;
begin
  if not private.is_allowed() then raise exception 'Akses ditolak.' using errcode = '42501'; end if;
  if p_request_id is null or jsonb_typeof(p_changes) is distinct from 'array' then
    raise exception 'Permintaan tidak valid.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_changes) = 0 or jsonb_array_length(p_changes) > 2000 or octet_length(p_changes::text) > 2000000 then
    raise exception 'Permintaan tidak valid atau terlalu besar.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(740261519);
  v_fingerprint := sha256(convert_to(p_changes::text, 'UTF8'));
  select fingerprint into v_existing from private.mutation_requests where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if v_existing <> v_fingerprint then raise exception 'ID permintaan sudah dipakai untuk data berbeda.' using errcode = '22023'; end if;
    return;
  end if;
  -- Check deletions before ledger reversals increment wallet versions inside this RPC.
  for op in select value from jsonb_array_elements(p_changes) where value->>'type' = 'wallet.delete' loop
    select * into w from public.wallets where id=(op->>'id')::uuid;
    if not found or not private.can_access_wallet(w.id) or w.owner_id <> auth.uid() then raise exception 'Rekening tidak dapat dihapus.' using errcode='42501'; end if;
    if w.version is distinct from (op->>'version')::bigint then raise exception 'Saldo telah berubah. Muat ulang dahulu.' using errcode='40001'; end if;
  end loop;
  for op in select value from jsonb_array_elements(p_changes) loop
    d := op->'data'; v_id := (op->>'id')::uuid; v_version := (op->>'version')::bigint;
    case op->>'type'
    when 'wallet.put' then
      select * into w from public.wallets where id = v_id;
      if found then
        if not private.can_access_wallet(v_id) or w.owner_id <> auth.uid() then raise exception 'Rekening tidak dapat diubah.' using errcode = '42501'; end if;
        if v_version is distinct from w.version then raise exception 'Data telah berubah di perangkat lain. Muat ulang dan coba lagi.' using errcode = '40001'; end if;
        if (d->>'shared')::boolean is distinct from (w.household_id is not null) then raise exception 'Jenis kepemilikan rekening tidak dapat diubah.'; end if;
        update public.wallets set name = trim(d->>'name'), provider = d->>'provider', color = d->>'color', suffix = coalesce(d->>'suffix',''),
          opening_balance = (d->>'opening')::bigint, balance = balance + (d->>'opening')::bigint - opening_balance, version = version + 1 where id = v_id;
      else
        if v_version is not null then raise exception 'Rekening sudah dihapus.' using errcode = '40001'; end if;
        v_household := null;
        if coalesce((d->>'shared')::boolean,false) then
          select a.household_id into v_household from private.allowed_users a join auth.users u on lower(u.email) = a.email where u.id = auth.uid() and a.active;
          if v_household is null then raise exception 'Keanggotaan bersama belum diatur.' using errcode = '42501'; end if;
        end if;
        insert into public.wallets(id,owner_id,household_id,name,provider,color,suffix,opening_balance,balance)
          values(v_id,auth.uid(),v_household,trim(d->>'name'),d->>'provider',d->>'color',coalesce(d->>'suffix',''),(d->>'opening')::bigint,(d->>'opening')::bigint);
      end if;
    when 'wallet.delete' then
      select * into w from public.wallets where id = v_id;
      if not found or not private.can_access_wallet(v_id) or w.owner_id <> auth.uid() then raise exception 'Rekening tidak dapat dihapus.' using errcode = '42501'; end if;
      delete from public.wallets where id = v_id;
    when 'transaction.put' then
      select * into t from public.transactions where id = v_id;
      if found then
        if not private.can_access_wallet(t.from_wallet_id) or (t.to_wallet_id is not null and not private.can_access_wallet(t.to_wallet_id)) then
          raise exception 'Rekening pribadi anggota lain tidak dapat diubah.' using errcode = '42501'; end if;
        if t.version is distinct from v_version then raise exception 'Transaksi telah diubah di perangkat lain.' using errcode = '40001'; end if;
      elsif v_version is not null then raise exception 'Transaksi sudah dihapus.' using errcode = '40001';
      end if;
      v_category := d->>'category';
      v_kind := case when v_category = 'Transfer' then 'transfer' when d->>'kind' = 'income' then 'income' else 'expense' end;
      if v_kind = 'income' then v_category := 'Pemasukan'; end if;
      if not private.can_access_wallet((d->>'accountId')::uuid) or
        (v_kind = 'transfer' and not private.can_access_wallet((d->>'toId')::uuid)) then raise exception 'Pilih rekening yang dapat kamu akses.' using errcode = '42501'; end if;
      if not (d->>'date' ~ '^\d{4}-\d{2}-\d{2}$') or (d->>'date')::date > (now() at time zone 'Asia/Jakarta')::date then raise exception 'Tanggal tidak valid atau di masa depan.' using errcode = '22023'; end if;
      insert into public.transactions(id,created_by,kind,category,amount,fee,date,from_wallet_id,to_wallet_id,source,catatan,reference,receipt_hash)
        values(v_id,auth.uid(),v_kind,v_category,(d->>'amount')::bigint,coalesce((d->>'fee')::bigint,0),(d->>'date')::date,
          (d->>'accountId')::uuid,case when v_kind = 'transfer' then (d->>'toId')::uuid end,
          case when v_kind = 'income' then trim(coalesce(d->>'source','')) else '' end,
          nullif(trim(coalesce(d->>'note','')),''),nullif(trim(coalesce(d->>'reference','')),''),decode(nullif(d->>'receiptHash',''),'hex'))
        on conflict(id) do update set kind=excluded.kind, category=excluded.category, amount=excluded.amount, fee=excluded.fee,
          date=excluded.date, from_wallet_id=excluded.from_wallet_id, to_wallet_id=excluded.to_wallet_id,
          source=excluded.source,catatan=excluded.catatan,reference=excluded.reference,receipt_hash=excluded.receipt_hash,version=transactions.version+1;
    when 'transaction.delete' then
      select * into t from public.transactions where id = v_id;
      if not found or not private.can_access_wallet(t.from_wallet_id) or (t.to_wallet_id is not null and not private.can_access_wallet(t.to_wallet_id)) then
        raise exception 'Transaksi tidak dapat dihapus.' using errcode = '42501'; end if;
      if t.version is distinct from v_version then raise exception 'Transaksi telah berubah di perangkat lain.' using errcode = '40001'; end if;
      delete from public.transactions where id = v_id;
    when 'goal.put' then
      select * into g from public.goals where id = v_id;
      if found then
        if not private.can_access_wallet(g.wallet_id) or g.version is distinct from v_version then raise exception 'Tujuan telah berubah atau tidak dapat diakses.' using errcode = '40001'; end if;
      elsif v_version is not null then raise exception 'Tujuan sudah dihapus.' using errcode = '40001';
      end if;
      if not private.can_access_wallet((d->>'accountId')::uuid) then raise exception 'Rekening tujuan tidak dapat diakses.' using errcode = '42501'; end if;
      insert into public.goals(id,wallet_id,name,target,emoji) values(v_id,(d->>'accountId')::uuid,trim(d->>'name'),(d->>'target')::bigint,d->>'emoji')
        on conflict(id) do update set wallet_id=excluded.wallet_id,name=excluded.name,target=excluded.target,emoji=excluded.emoji,version=goals.version+1;
    when 'goal.delete' then
      select * into g from public.goals where id = v_id;
      if not found or not private.can_access_wallet(g.wallet_id) then raise exception 'Tujuan tidak dapat dihapus.' using errcode = '42501'; end if;
      if g.version is distinct from v_version then raise exception 'Tujuan telah berubah.' using errcode = '40001'; end if;
      delete from public.goals where id = v_id;
    when 'plan.put' then
      if not exists(select 1 from public.plans where user_id = auth.uid() and version = v_version) then raise exception 'Rencana telah berubah.' using errcode = '40001'; end if;
      update public.plans set reserve=(d->>'reserve')::bigint,saving=(d->>'saving')::smallint,fun=(d->>'fun')::smallint,
        together=(d->>'together')::smallint,version=version+1 where user_id=auth.uid();
    else raise exception 'Operasi tidak dikenal.' using errcode = '22023';
    end case;
  end loop;
  insert into private.mutation_requests(user_id,request_id,fingerprint) values(auth.uid(),p_request_id,v_fingerprint);
  delete from private.mutation_requests where user_id=auth.uid() and created_at < now()-interval '30 days';
end;
$$;

-- Poll a compact, RLS-scoped revision instead of downloading years of history.
-- Every ledger mutation also increments the affected wallet versions.
create function public.finance_revision() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object('allowed', private.is_allowed(), 'revision', md5(
    coalesce((select string_agg(id::text || ':' || version::text, ',' order by id) from public.wallets), '') || '|' ||
    coalesce((select string_agg(id::text || ':' || version::text, ',' order by id) from public.goals), '') || '|' ||
    coalesce((select version::text from public.plans where user_id=auth.uid()), '')
  ));
$$;
-- One MVCC snapshot for wallet balances + ledger; no torn multi-query reads.
create function public.finance_snapshot() returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'allowed', private.is_allowed(),
    'revision', public.finance_revision()->>'revision',
    'wallets', coalesce((select jsonb_agg(w order by w.created_at) from public.wallets w),'[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(t order by t.date desc,t.id) from public.transactions t),'[]'::jsonb),
    'goals', coalesce((select jsonb_agg(g) from public.goals g),'[]'::jsonb),
    'plan', (select to_jsonb(p) from public.plans p where p.user_id = auth.uid())
  );
$$;

create function public.reserve_receipt_scan() returns void language plpgsql security definer set search_path = '' as $$
declare n integer; spec record;
begin
  if not private.is_allowed() then raise exception 'Akses ditolak.' using errcode='42501'; end if;
  for spec in select * from (values ('minute',5),('hour',30),('day',80)) v(period,maximum) loop
    insert into private.scan_limits values(auth.uid(),spec.period,date_trunc(spec.period,now()),1)
      on conflict(user_id,period,bucket) do update set count=scan_limits.count+1 returning count into n;
    if n > spec.maximum then raise exception 'Batas pembacaan nota tercapai. Coba beberapa saat lagi.' using errcode='54000'; end if;
  end loop;
  delete from private.scan_limits where user_id=auth.uid() and bucket < now()-interval '2 days';
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_allowed(), private.can_access_wallet(uuid) to authenticated;
revoke all on function public.bootstrap_finance(),public.commit_finance(uuid,jsonb),public.finance_snapshot(),public.finance_revision(),public.reserve_receipt_scan() from public,anon;
grant execute on function public.bootstrap_finance(),public.commit_finance(uuid,jsonb),public.finance_snapshot(),public.finance_revision(),public.reserve_receipt_scan() to authenticated;
-- Keep the private schema OUT of Supabase's exposed API schemas.
do $$ declare t text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach t in array array['wallets','transactions','goals','plans','household_members'] loop
      execute format('alter publication supabase_realtime add table public.%I',t);
    end loop;
  end if;
end $$;
commit;
