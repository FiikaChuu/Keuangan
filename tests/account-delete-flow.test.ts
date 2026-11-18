import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteOwnAccount } from '../src/account-delete';
const request = () =>
  new Request('https://app.test/api/account', {
    method: 'DELETE',
    headers: { Authorization: 'Bearer old' },
    body: JSON.stringify({ password: 'verified-on-server', confirmation: 'HAPUS AKUN' }),
  });
for (const failure of ['prepare', 'revoke', 'delete', null])
  test(`deletion ordering, fail-closed ${failure ?? 'success'}`, async () => {
    const calls: string[] = [];
    const client = {
      auth: {
        getUser: async (token: string) => {
          calls.push(`identity:${token}`);
          return { data: { user: { id: 'self', email: 'self@example.com' } }, error: null };
        },
        signInWithPassword: async () => {
          calls.push('reauth');
          return {
            data: { user: { id: 'self' }, session: { access_token: 'fresh' } },
            error: null,
          };
        },
        admin: {
          signOut: async (token: string, scope: string) => {
            calls.push(`revoke:${token}:${scope}`);
            return { error: failure === 'revoke' ? {} : null };
          },
          deleteUser: async (id: string) => {
            calls.push(`delete:${id}`);
            return { error: failure === 'delete' ? {} : null };
          },
        },
      },
      rpc: async (_name: string, args: { p_user_id: string }) => {
        if (_name === 'acquire_lifecycle_reauth')
          return { data: '11111111-1111-4111-8111-111111111111', error: null };
        if (_name === 'release_lifecycle_reauth') return { data: null, error: null };
        calls.push(`prepare:${args.p_user_id}`);
        return { error: failure === 'prepare' ? {} : null };
      },
    };
    const response = await deleteOwnAccount(
      request(),
      { url: 'https://example.test', key: 'test' },
      () => client as never,
    );
    assert.equal(response.status, failure === 'prepare' ? 409 : failure ? 503 : 200);
    assert.deepEqual(calls.slice(0, 3), ['identity:old', 'reauth', 'prepare:self']);
    if (failure === 'prepare') assert.equal(calls.includes('delete:self'), false);
    if (failure === 'revoke') assert.equal(calls.includes('delete:self'), false);
    if (!failure) assert.deepEqual(calls.slice(3), ['revoke:fresh:global', 'delete:self']);
  });
