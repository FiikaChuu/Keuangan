// Synthetic local PostgreSQL/Auth schema only; not hosted Supabase verification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
async function database() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;`);
  for (const file of ['01-schema.sql', '04-tenant-lifecycle.sql', '05-personal-reset.sql'])
    await db.exec(await readFile('supabase/' + file, 'utf8'));
  // Exercise additive upgrade twice to verify replay preserves controls/receipts.
  await db.exec(await readFile('supabase/07-lifecycle-blockers-upgrade.sql', 'utf8'));
  await db.exec(await readFile('supabase/07-lifecycle-blockers-upgrade.sql', 'utf8'));
  return db;
}
test('signup defaults closed while active legacy mapping survives', async () => {
  const db = await database();
  try {
    await assert.rejects(
      db.query(`insert into auth.users values($1,'new@test.invalid',now())`, [crypto.randomUUID()]),
      /ditutup/,
    );
    await db.exec(
      `insert into private.allowed_users(email,household_id) values('legacy@test.invalid','0f739560-0427-4dca-8247-9e2f885d5191')`,
    );
    await db.query(`insert into auth.users values($1,'legacy@test.invalid',now())`, [
      crypto.randomUUID(),
    ]);
    await db.exec('delete from private.lifecycle_controls');
    await assert.rejects(
      db.query(`insert into auth.users values($1,'missing-control@test.invalid',now())`, [
        crypto.randomUUID(),
      ]),
      /ditutup/,
    );
    await db.exec('set role authenticated');
    await assert.rejects(
      db.exec('update private.lifecycle_controls set signup_enabled=true'),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
test('expired incomplete reset is renewed but completed receipts never change', async () => {
  const db = await database();
  try {
    // Explicit synthetic administrator opt-in, never a production action.
    await db.exec(`update private.lifecycle_controls set signup_enabled=true`);
    const user = crypto.randomUUID(),
      id = crypto.randomUUID();
    await db.query(`insert into auth.users values($1,'reset@test.invalid',now())`, [user]);
    const ticket = async () =>
      (await db.query<{ t: string }>('select public.authorize_personal_reset($1,$2) t', [user, id]))
        .rows[0].t;
    const original = await ticket();
    await db.query(
      `update private.personal_reset_requests set created_at=now()-interval '6 minutes' where user_id=$1`,
      [user],
    );
    const renewed = await ticket();
    assert.notEqual(renewed, original);
    assert.equal(await ticket(), renewed);
    await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [user]);
    const revision = (
      await db.query<{ r: { revision: string } }>('select public.finance_revision() r')
    ).rows[0].r.revision;
    await assert.rejects(
      db.query('select public.reset_personal_finance($1,$2,$3)', [id, revision, original]),
      /Verifikasi/,
    );
    await db.query('select public.reset_personal_finance($1,$2,$3)', [id, revision, renewed]);
    await db.exec(
      `update private.personal_reset_requests set created_at=now()-interval '6 minutes'`,
    );
    const before = (await db.query('select * from private.personal_reset_requests')).rows;
    assert.equal(await ticket(), renewed);
    assert.deepEqual(
      (await db.query('select * from private.personal_reset_requests')).rows,
      before,
    );
    assert.equal(
      (
        await db.query<{ r: { replayed: boolean } }>(
          'select public.reset_personal_finance($1,$2,$3) r',
          [id, revision, renewed],
        )
      ).rows[0].r.replayed,
      true,
    );
  } finally {
    await db.close();
  }
});
