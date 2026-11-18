import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOwnAccount } from '../src/account-delete';

test('deletion fails closed without server configuration', async () => {
  const result = await deleteOwnAccount(
    new Request('https://app.test/api/account', { method: 'DELETE' }),
    {},
  );
  assert.equal(result.status, 503);
});
test('deletion rejects an arbitrary target before contacting auth', async () => {
  const result = await deleteOwnAccount(
    new Request('https://app.test/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ userId: 'victim', confirmation: 'HAPUS AKUN', password: 'secret' }),
    }),
    { url: 'https://example.test', key: 'server-only' },
  );
  assert.equal(result.status, 400);
});
test('server reauthentication must match token identity; never prepares a victim', async () => {
  let prepared = false;
  const result = await deleteOwnAccount(
    new Request('https://app.test/api/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
      body: JSON.stringify({ confirmation: 'HAPUS AKUN', password: 'secret' }),
    }),
    { url: 'https://example.test', key: 'server-only' },
    () =>
      ({
        auth: {
          getUser: async () => ({
            data: { user: { id: 'owner', email: 'owner@example.com' } },
            error: null,
          }),
          signInWithPassword: async () => ({
            data: { user: { id: 'victim' }, session: { access_token: 'fresh' } },
            error: null,
          }),
        },
        rpc: async (name: string) => {
          if (name === 'acquire_lifecycle_reauth')
            return { data: '11111111-1111-4111-8111-111111111111', error: null };
          if (name === 'release_lifecycle_reauth') return { data: null, error: null };
          prepared = true;
          return { error: null };
        },
      }) as never,
  );
  assert.equal(result.status, 401);
  assert.equal(prepared, false);
});
