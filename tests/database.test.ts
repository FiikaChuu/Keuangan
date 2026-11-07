import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  b = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const personal = '11111111-1111-4111-8111-111111111111',
  joint = '22222222-2222-4222-8222-222222222222';
test('real PostgreSQL schema: RLS, atomic ledger, conflicts, deduplication and whitelist', async (suite) => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;`);
  await db.exec(await readFile('supabase/01-schema.sql', 'utf8'));
  await db.exec(`insert into private.allowed_users values('a@example.com','0f739560-0427-4dca-8247-9e2f885d5191',true),('b@example.com','0f739560-0427-4dca-8247-9e2f885d5191',true);
    insert into auth.users values('${a}','a@example.com',now()),('${b}','b@example.com',now());`);
  async function as(user: string) {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec('set role authenticated');
  }
  const commit = (ops: unknown[], id = crypto.randomUUID()) =>
    db.query('select public.commit_finance($1::uuid,$2::jsonb)', [id, JSON.stringify(ops)]);
  const wallet = (id: string, shared: boolean, opening: number) => ({
    type: 'wallet.put',
    id,
    data: {
      name: shared ? 'Bersama' : 'Pribadi',
      shared,
      opening,
      provider: 'BCA',
      color: '#1D2949',
      suffix: '',
    },
  });
  const tx = (id: string, amount = 100000, fee = 2500) => ({
    type: 'transaction.put',
    id,
    data: {
      kind: 'expense',
      category: 'Transfer',
      title: 'IGNORED',
      amount,
      fee,
      date: '2026-01-01',
      accountId: personal,
      toId: joint,
      note: null,
    },
  });
  async function values() {
    return (
      await db.query<{ id: string; balance: number }>(
        'select id,balance from public.wallets order by id',
      )
    ).rows;
  }
  await as(a);
  await db.exec('select public.bootstrap_finance()');
  await commit([wallet(personal, false, 500000), wallet(joint, true, 0)]);
  await as(b);
  await db.exec('select public.bootstrap_finance()');
  await as(a);
  const id = crypto.randomUUID();
  await suite.test('category Transfer auto-detects kind, title and both balances', async () => {
    await commit([tx(id)]);
    assert.deepEqual(
      (await values()).map((x) => Number(x.balance)),
      [397500, 100000],
    );
    const row = (await db.query('select kind,title,category,catatan from public.transactions'))
      .rows[0];
    assert.deepEqual(row, {
      kind: 'transfer',
      title: 'Transfer',
      category: 'Transfer',
      catatan: null,
    });
  });
  await suite.test('same request is idempotent, including on another device', async () => {
    const request = crypto.randomUUID(),
      ops = [tx(crypto.randomUUID(), 1000, 0)];
    await commit(ops, request);
    const first = await values();
    await commit(ops, request);
    assert.deepEqual(await values(), first);
    await assert.rejects(commit([tx(crypto.randomUUID(), 2000, 0)], request));
  });
  await suite.test('failed destination reversal rolls back the source and ledger', async () => {
    const expense = {
      type: 'transaction.put',
      id: crypto.randomUUID(),
      data: {
        kind: 'expense',
        category: 'Makan',
        amount: 100000,
        fee: 0,
        date: '2026-01-01',
        accountId: joint,
      },
    };
    await commit([expense]);
    const first = await values();
    await assert.rejects(commit([{ type: 'transaction.delete', id, version: 1 }]));
    assert.deepEqual(await values(), first);
    assert.equal(
      (await db.query('select count(*) from public.transactions where id=$1', [id])).rows[0].count,
      1,
    );
  });
  await suite.test(
    'overdraw, same-account, fractional, NaN, negative and future amounts fail',
    async () => {
      const first = await values();
      for (const changes of [
        { amount: 999999999 },
        { toId: personal },
        { amount: 1.5 },
        { amount: 'NaN' },
        { amount: -1 },
        { date: '2099-01-01' },
      ]) {
        const operation = tx(crypto.randomUUID());
        Object.assign(operation.data, changes);
        await assert.rejects(commit([operation]));
      }
      assert.deepEqual(await values(), first);
    },
  );
  await suite.test(
    'member sees shared transfer but cannot read or mutate partner private wallet',
    async () => {
      await as(b);
      assert.deepEqual(
        (await values()).map((w) => w.id),
        [joint],
      );
      assert.equal(
        (await db.query('select count(*) from public.transactions where id=$1', [id])).rows[0]
          .count,
        1,
      );
      await assert.rejects(commit([tx(crypto.randomUUID())]));
      await assert.rejects(commit([{ type: 'transaction.delete', id, version: 1 }]));
      await assert.rejects(
        db.query('update public.wallets set balance=1000000 where id=$1', [joint]),
      );
      await as(a);
    },
  );
  await suite.test('direct ledger writes bypassing RPC are denied', async () => {
    await assert.rejects(db.exec('delete from public.transactions'));
    await assert.rejects(db.exec('select * from private.allowed_users'));
    await assert.rejects(
      db.exec(
        'insert into public.household_members select household_id,gen_random_uuid() from public.household_members',
      ),
    );
  });
  await suite.test('stale edits are rejected and an edit is counted once', async () => {
    const next = tx(crypto.randomUUID(), 5000, 0);
    await commit([next]);
    await commit([{ ...next, version: 1, data: { ...next.data, amount: 7000 } }]);
    const first = await values();
    await assert.rejects(commit([{ ...next, version: 1, data: { ...next.data, amount: 8000 } }]));
    assert.deepEqual(await values(), first);
  });
  await suite.test(
    'receipt fingerprint deduplicates the same shared source across users',
    async () => {
      const data = {
        kind: 'expense',
        category: 'Belanja',
        amount: 100,
        fee: 0,
        date: '2026-01-01',
        accountId: joint,
        receiptHash: 'ab'.repeat(32),
      };
      await commit([{ type: 'transaction.put', id: crypto.randomUUID(), data }]);
      await as(b);
      await assert.rejects(commit([{ type: 'transaction.put', id: crypto.randomUUID(), data }]));
      await as(a);
    },
  );
  await suite.test(
    'revision changes on a note-only edit but never reveals a partner private change',
    async () => {
      const revision = async () =>
        (
          await db.query<{ finance_revision: { revision: string } }>(
            'select public.finance_revision()',
          )
        ).rows[0].finance_revision.revision;
      await as(b);
      const other = await revision();
      await as(a);
      const mine = await revision();
      const operation = {
        type: 'transaction.put',
        id: crypto.randomUUID(),
        data: {
          kind: 'expense',
          category: 'Makan',
          amount: 1,
          fee: 0,
          date: '2026-01-01',
          accountId: personal,
        },
      };
      await commit([operation]);
      assert.notEqual(await revision(), mine);
      const after = await revision();
      await commit([{ ...operation, version: 1, data: { ...operation.data, note: 'new note' } }]);
      assert.notEqual(await revision(), after);
      await as(b);
      assert.equal(await revision(), other);
      await as(a);
    },
  );
  await suite.test('null batches and stale goal recreation are rejected', async () => {
    await assert.rejects(
      db.query('select public.commit_finance($1::uuid,null)', [crypto.randomUUID()]),
    );
    await assert.rejects(commit([]));
    await assert.rejects(
      commit([
        {
          type: 'goal.put',
          id: crypto.randomUUID(),
          version: 1,
          data: { accountId: personal, name: 'Deleted', target: 1000, emoji: 'x' },
        },
      ]),
    );
  });
  await suite.test('scanner has a database-enforced rate limit', async () => {
    for (let i = 0; i < 5; i++) await db.exec('select public.reserve_receipt_scan()');
    await assert.rejects(db.exec('select public.reserve_receipt_scan()'), /Batas pembacaan/);
  });
  await suite.test('anon cannot call privileged RPCs', async () => {
    await db.exec('reset role; set role anon');
    await assert.rejects(commit([tx(crypto.randomUUID())]));
    await assert.rejects(db.exec('select * from public.wallets'));
    await as(a);
  });
  await suite.test('signup allowlist cannot be bypassed by metadata or public signup', async () => {
    await db.exec('reset role');
    await assert.rejects(
      db.query('insert into auth.users values($1,$2,now())', [
        crypto.randomUUID(),
        'stranger@example.com',
      ]),
    );
    await db.exec("update private.allowed_users set active=false where email='b@example.com'");
    await as(b);
    assert.equal((await values()).length, 0);
    await assert.rejects(commit([tx(crypto.randomUUID())]));
  });
  await db.close();
});
