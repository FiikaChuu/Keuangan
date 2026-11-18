import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('personal reset: atomic shared rejection, scoped deletion, retries, version and JWT fence', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon;`);
  for (const file of ['01-schema.sql', '04-tenant-lifecycle.sql', '05-personal-reset.sql'])
    await db.exec(await readFile('supabase/' + file, 'utf8'));
  // Synthetic administrator opt-in only; production remains closed.
  await db.exec('update private.lifecycle_controls set signup_enabled=true');
  const a = crypto.randomUUID(),
    b = crypto.randomUUID(),
    p = crypto.randomUUID(),
    s = crypto.randomUUID(),
    other = crypto.randomUUID(),
    tx = crypto.randomUUID();
  await db.query(
    `insert into auth.users values($1,'a@reset.test',now()),($2,'b@reset.test',now())`,
    [a, b],
  );
  async function as(id: string, iat = 0) {
    await db.exec('reset role');
    await db.query(
      `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,
      [id, JSON.stringify({ iat })],
    );
    await db.exec('set role authenticated');
  }
  async function ticket(user: string, id: string) {
    await db.exec('reset role; set role service_role');
    return (
      await db.query<{ t: string }>('select public.authorize_personal_reset($1,$2) t', [user, id])
    ).rows[0].t;
  }
  async function rev() {
    return (await db.query<{ r: { revision: string } }>('select public.finance_revision() r'))
      .rows[0].r.revision;
  }
  const reset = (id: string, r: string, t: string) =>
    db.query('select public.reset_personal_finance($1,$2,$3)', [id, r, t]);
  const commit = (ops: unknown[]) =>
    db.query('select public.commit_finance($1,$2)', [crypto.randomUUID(), JSON.stringify(ops)]);
  await as(a);
  await db.exec('select public.bootstrap_finance()');
  await commit([
    {
      type: 'wallet.put',
      id: p,
      data: { name: 'Personal', provider: 'Cash', color: '#123456', opening: 100, shared: false },
    },
    {
      type: 'wallet.put',
      id: s,
      data: { name: 'Shared', provider: 'Cash', color: '#123456', opening: 100, shared: true },
    },
  ]);
  await commit([
    {
      type: 'transaction.put',
      id: tx,
      data: {
        kind: 'transfer',
        category: 'Transfer',
        accountId: p,
        toId: s,
        amount: 10,
        date: '2026-01-01',
      },
    },
  ]);
  const revision = await rev(),
    id = crypto.randomUUID(),
    t = await ticket(a, id);
  await as(b);
  await assert.rejects(reset(id, revision, t), /Verifikasi/);
  await assert.rejects(
    db.query('select public.authorize_personal_reset($1,$2)', [a, id]),
    /permission denied/,
  );
  await as(a);
  const before = await db.query('select * from public.wallets order by id');
  await assert.rejects(reset(id, revision, t), /terhubung/);
  assert.deepEqual(await db.query('select * from public.wallets order by id'), before);
  assert.equal((await db.query('select * from public.transactions')).rows.length, 1);
  await commit([{ type: 'transaction.delete', id: tx, version: 1 }]);
  await assert.rejects(reset(id, revision, t), /Data berubah/);
  // A reset must not reverse ledger rows one-by-one: income spent after receipt can
  // otherwise underflow. Both transactions and wallet disappear atomically.
  await commit([
    {
      type: 'transaction.put',
      id: crypto.randomUUID(),
      data: {
        kind: 'income',
        category: 'Pemasukan',
        accountId: p,
        source: 'Salary',
        amount: 200,
        date: '2026-01-01',
      },
    },
    {
      type: 'transaction.put',
      id: crypto.randomUUID(),
      data: { kind: 'expense', category: 'Makan', accountId: p, amount: 250, date: '2026-01-02' },
    },
  ]);
  await as(b);
  await db.exec('select public.bootstrap_finance()');
  await commit([
    {
      type: 'wallet.put',
      id: other,
      data: { name: 'Other', provider: 'Cash', color: '#123456', opening: 50, shared: false },
    },
    {
      type: 'goal.put',
      id: crypto.randomUUID(),
      data: { accountId: other, name: 'Other goal', target: 100, emoji: 'x' },
    },
  ]);
  await as(a);
  await commit([
    {
      type: 'goal.put',
      id: crypto.randomUUID(),
      data: { accountId: p, name: 'Own goal', target: 500, emoji: 'x' },
    },
  ]);
  await commit([
    {
      type: 'transaction.put',
      id: crypto.randomUUID(),
      data: { kind: 'expense', category: 'Makan', accountId: s, amount: 5, date: '2026-01-01' },
    },
  ]);
  const sharedHistory = (
    await db.query('select * from public.transactions where from_wallet_id=$1', [s])
  ).rows;
  const current = await rev();
  const sharedBefore = (await db.query('select * from public.wallets where id=$1', [s])).rows;
  await reset(id, current, t);
  await reset(id, current, t);
  await assert.rejects(reset(id, revision, t), /ID permintaan/);
  assert.deepEqual(
    (await db.query('select * from public.wallets where id=$1', [s])).rows,
    sharedBefore,
  );
  assert.deepEqual((await db.query('select * from public.transactions')).rows, sharedHistory);
  assert.equal((await db.query('select * from public.goals')).rows.length, 0);
  assert.equal((await db.query('select * from public.wallets where id=$1', [p])).rows.length, 0);
  assert.equal((await db.query('select * from public.plans')).rows.length, 0);
  await assert.rejects(
    commit([{ type: 'wallet.put', id: crypto.randomUUID(), data: {} }]),
    /Sesi sebelum reset/,
  );
  await assert.rejects(db.exec('select public.bootstrap_finance()'), /Sesi sebelum reset/);
  await as(b);
  assert.equal((await db.query('select * from public.goals')).rows.length, 1);
  // Zero personal data succeeds and retries cannot wipe later data.
  const emptyId = crypto.randomUUID(),
    emptyTicket = await ticket(a, emptyId);
  await as(a, Math.ceil(Date.now() / 1000) + 10);
  const emptyRev = await rev();
  await reset(emptyId, emptyRev, emptyTicket);
  await as(a, Math.ceil(Date.now() / 1000) + 20);
  await db.exec('select public.bootstrap_finance()');
  await commit([
    {
      type: 'wallet.put',
      id: crypto.randomUUID(),
      data: { name: 'New', provider: 'Cash', color: '#123456', opening: 1, shared: false },
    },
  ]);
  await reset(emptyId, emptyRev, emptyTicket);
  assert.equal((await db.query('select * from public.wallets')).rows.length, 2);
  await db.exec('reset role');
  assert.equal((await db.query('select * from auth.users')).rows.length, 2);
  assert.equal((await db.query('select * from private.allowed_users where active')).rows.length, 2);
  // Capability expiration rejects without deleting; unauthenticated execution denied.
  const expiredId = crypto.randomUUID(),
    expiredTicket = await ticket(b, expiredId);
  await db.exec('reset role');
  await db.query(
    "update private.personal_reset_requests set created_at=now()-interval '6 minutes' where request_id=$1",
    [expiredId],
  );
  await as(b);
  await assert.rejects(reset(expiredId, await rev(), expiredTicket), /kedaluwarsa/);
  await db.exec('reset role; set role anon');
  await assert.rejects(reset(expiredId, 'a'.repeat(32), expiredTicket), /permission denied/);
  await db.exec('reset role');
  await db.query('update private.account_lifecycle set deletion_pending=true where user_id=$1', [
    a,
  ]);
  await as(a);
  await assert.rejects(reset(emptyId, emptyRev, emptyTicket), /Akses ditolak/);
  await db.close();
});
