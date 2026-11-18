import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('tenant migration preserves legacy and isolates public signup without metadata authority', async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;`);
  await db.exec(await readFile('supabase/01-schema.sql', 'utf8'));
  const legacy = crypto.randomUUID(),
    a = crypto.randomUUID(),
    b = crypto.randomUUID();
  await db.query(`insert into private.allowed_users values('legacy@example.com','0f739560-0427-4dca-8247-9e2f885d5191',true);
    `);
  await db.query(`insert into auth.users values($1,'legacy@example.com',now(),null)`, [legacy]);
  await db.exec(await readFile('supabase/04-tenant-lifecycle.sql', 'utf8'));
  // Synthetic administrator explicitly opens signup for isolation tests.
  await db.exec('update private.lifecycle_controls set signup_enabled=true');
  await db.query(
    `insert into auth.users values($1,'a@example.com',now(),'{"household_id":"0f739560-0427-4dca-8247-9e2f885d5191","role":"admin"}'),($2,'b@example.com',now(),null)`,
    [a, b],
  );
  async function as(id: string) {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
    await db.exec('set role authenticated');
    await db.exec('select public.bootstrap_finance()');
  }
  const commit = (ops: unknown[]) =>
    db.query('select public.commit_finance($1,$2)', [crypto.randomUUID(), JSON.stringify(ops)]);
  const wallet = crypto.randomUUID();
  await as(a);
  await commit([
    {
      type: 'wallet.put',
      id: wallet,
      data: { name: 'Milik A', shared: true, opening: 0, provider: 'Tunai', color: '#123456' },
    },
  ]);
  const own = (await db.query<{ household_id: string }>('select household_id from public.wallets'))
    .rows[0].household_id;
  assert.notEqual(own, '0f739560-0427-4dca-8247-9e2f885d5191');
  await as(b);
  assert.equal((await db.query('select * from public.wallets')).rows.length, 0);
  await assert.rejects(commit([{ type: 'wallet.delete', id: wallet, version: 1 }]));
  await assert.rejects(db.query('select public.prepare_self_delete($1)', [a]), /permission denied/);
  await as(legacy);
  assert.equal(
    (await db.query<{ household_id: string }>('select household_id from public.household_members'))
      .rows[0].household_id,
    '0f739560-0427-4dca-8247-9e2f885d5191',
  );
  await as(a);
  const txId = crypto.randomUUID();
  await commit([
    {
      type: 'transaction.put',
      id: txId,
      data: {
        kind: 'income',
        category: 'Pemasukan',
        amount: 1,
        fee: 0,
        date: '2026-01-01',
        accountId: wallet,
        source: 'Test',
      },
    },
  ]);
  await assert.rejects(
    commit([
      { type: 'transaction.delete', id: txId, version: 1 },
      { type: 'wallet.delete', id: wallet, version: 2 },
    ]),
    /riwayat/,
  );
  assert.equal((await db.query('select * from public.transactions')).rows.length, 1);
  await db.exec('reset role; set role service_role');
  await assert.rejects(db.query('select public.prepare_self_delete($1)', [a]), /dompet/);
  await as(a);
  await commit([{ type: 'transaction.delete', id: txId, version: 1 }]);
  const requestId = crypto.randomUUID(),
    deleteOps = JSON.stringify([{ type: 'wallet.delete', id: wallet, version: 3 }]);
  await db.query('select public.commit_finance($1,$2)', [requestId, deleteOps]);
  await db.query('select public.commit_finance($1,$2)', [requestId, deleteOps]);
  await db.exec('reset role; set role service_role');
  await db.query('select public.prepare_self_delete($1)', [a]);
  await db.query('select public.prepare_self_delete($1)', [a]);
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [a]);
  await db.exec('set role authenticated');
  assert.equal(
    (await db.query<{ allowed: boolean }>('select private.is_allowed() allowed')).rows[0].allowed,
    false,
  );
  await assert.rejects(
    commit([{ type: 'wallet.put', id: crypto.randomUUID(), data: {} }]),
    /Akses ditolak/,
  );
  await db.close();
});
