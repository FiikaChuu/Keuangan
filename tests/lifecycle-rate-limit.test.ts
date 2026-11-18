// Synthetic PGlite, not a live/distributed Supabase measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { deleteOwnAccount } from '../src/account-delete';
import { resetOwnPersonalData } from '../src/account-reset';
test('reauth limiter service-only, transactional lease and fixed-window budget', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role; create schema private; create schema auth; create table auth.users(id uuid primary key);`,
    );
    await db.exec(await readFile('supabase/06-lifecycle-reauth-limit.sql', 'utf8'));
    const user = crypto.randomUUID(),
      other = crypto.randomUUID();
    await db.query('insert into auth.users values($1),($2)', [user, other]);
    const acquire = async (u = user) =>
      (await db.query<{ t: string | null }>('select public.acquire_lifecycle_reauth($1) t', [u]))
        .rows[0].t;
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role);
      await assert.rejects(acquire(), /permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const first = await acquire();
    assert.ok(first);
    assert.equal(await acquire(), null); // concurrent request denied, no Auth call
    const otherLease = await acquire(other);
    assert.ok(otherLease);
    await db.query('select public.release_lifecycle_reauth($1,$2)', [user, otherLease]);
    assert.equal(await acquire(), null); // wrong lease cannot release
    await db.query('select public.release_lifecycle_reauth($1,$2)', [user, first]);
    for (let n = 1; n < 5; n++) {
      const t = await acquire();
      assert.ok(t);
      await db.query('select public.release_lifecycle_reauth($1,$2)', [user, t]);
    }
    assert.equal(await acquire(), null);
    await db.exec('reset role');
    const row = (
      await db.query<{ attempts: number }>(
        'select attempts from private.lifecycle_reauth_limits where user_id=$1',
        [user],
      )
    ).rows[0];
    assert.equal(row.attempts, 5);
    await db.query(
      `update private.lifecycle_reauth_limits set window_started=now()-interval '16 minutes' where user_id=$1`,
      [user],
    );
    await db.exec('set role service_role');
    assert.ok(await acquire());
    await db.exec('reset role');
    await db.query(
      `update private.lifecycle_reauth_limits set lease_until=now()-interval '1 second' where user_id=$1`,
      [user],
    );
    await db.exec('set role service_role');
    assert.ok(await acquire());
    assert.equal(await acquire(crypto.randomUUID()), null);
  } finally {
    await db.close();
  }
});
for (const handler of [deleteOwnAccount, resetOwnPersonalData])
  for (const mode of ['deny', 'error', 'malformed'])
    test(`${handler.name} ${mode} limiter prevents password Auth call`, async () => {
      let passwords = 0;
      const calls: string[] = [];
      const client = {
        auth: {
          getUser: async () => ({
            data: { user: { id: 'verified-owner', email: 'real@test.invalid' } },
            error: null,
          }),
          signInWithPassword: async () => {
            passwords++;
            throw Error('must not call');
          },
        },
        rpc: async (name: string, args: unknown) => {
          calls.push(name + JSON.stringify(args));
          return mode === 'error'
            ? { error: {} }
            : { data: mode === 'deny' ? null : { allowed: true }, error: null };
        },
      };
      const response = await handler(
        new Request('https://test.invalid', {
          method: 'POST',
          headers: { Authorization: 'Bearer original', 'x-forwarded-for': 'arbitrary' },
          body: JSON.stringify(
            handler === deleteOwnAccount
              ? { password: 'synthetic', confirmation: 'HAPUS AKUN' }
              : {
                  password: 'synthetic',
                  confirmation: 'RESET',
                  requestId: crypto.randomUUID(),
                  revision: 'a'.repeat(32),
                },
          ),
        }),
        { url: 'https://test.invalid', key: 'synthetic' },
        () => client as never,
      );
      assert.equal(response.status, mode === 'deny' ? 429 : 503);
      assert.equal(passwords, 0);
      assert.ok(calls[0].includes('verified-owner'));
      assert.ok(!calls.join().includes('arbitrary'));
    });
