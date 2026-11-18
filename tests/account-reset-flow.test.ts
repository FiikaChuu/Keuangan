import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { resetOwnPersonalData } from '../src/account-reset';

const id = crypto.randomUUID();
function harness(mode = 'ok') {
  const calls: unknown[] = [];
  let clients = 0;
  const factory = ((...args: unknown[]) => {
    const n = clients++;
    calls.push({ client: n, options: args[2] });
    return {
      auth: {
        getUser: async (token: string) => {
          calls.push({ getUser: token });
          return {
            data: {
              user:
                mode === 'badToken'
                  ? null
                  : {
                      id,
                      email: 'real@example.com',
                      factors: mode === 'mfa' ? [{ status: 'verified' }] : [],
                    },
            },
            error: null,
          };
        },
        signInWithPassword: async (input: unknown) => {
          calls.push({ reauth: input });
          return {
            data: {
              user: { id: mode === 'wrongUser' ? 'wrong' : id },
              session: { access_token: 'temporary' },
            },
            error: mode === 'badPassword' ? {} : null,
          };
        },
        admin: {
          signOut: async (token: string, scope: string) => {
            calls.push({ signOut: token, scope });
            return { error: null };
          },
        },
      },
      rpc: async (name: string, params: unknown) => {
        calls.push({ name, params });
        if (name === 'acquire_lifecycle_reauth')
          return { data: '11111111-1111-4111-8111-111111111111', error: null };
        if (name === 'release_lifecycle_reauth') return { data: null, error: null };
        if (name === 'authorize_personal_reset') return { data: 'ticket', error: null };
        return {
          data: { reset: true, replayed: false },
          error:
            mode === 'shared'
              ? { code: '23503' }
              : mode === 'stale'
                ? { code: '40001' }
                : mode === 'pending'
                  ? { code: '42501' }
                  : null,
        };
      },
    };
  }) as unknown as typeof createClient;
  return { factory, calls };
}
const config = { url: 'https://test.invalid', key: 'server-secret' };
function request(extra = {}) {
  return new Request('https://local/api/account/reset', {
    method: 'POST',
    headers: { authorization: 'Bearer verified-token' },
    body: JSON.stringify({
      password: 'not-logged-by-handler',
      confirmation: 'RESET',
      requestId: crypto.randomUUID(),
      revision: 'a'.repeat(32),
      ...extra,
    }),
  });
}
test('reset route validates real identity, reauth, strict body; fails closed', async () => {
  assert.equal((await resetOwnPersonalData(request(), {})).status, 503);
  for (const [mode, status] of [
    ['badToken', 401],
    ['mfa', 403],
    ['wrongUser', 401],
    ['badPassword', 401],
  ] as const) {
    const h = harness(mode);
    assert.equal((await resetOwnPersonalData(request(), config, h.factory)).status, status);
    assert.ok(
      !h.calls.some((c) =>
        ['authorize_personal_reset', 'reset_personal_finance'].includes(
          (c as { name: string }).name,
        ),
      ),
    );
  }
  const h = harness();
  assert.equal(
    (await resetOwnPersonalData(request({ userId: 'victim' }), config, h.factory)).status,
    400,
  );
  assert.equal(h.calls.length, 0);
  assert.equal(
    (await resetOwnPersonalData(request({ confirmation: 'reset' }), config, h.factory)).status,
    400,
  );
});
test('reset route never sends caller-selected identity; uses caller JWT for atomic RPC', async () => {
  const h = harness();
  const response = await resetOwnPersonalData(request(), config, h.factory);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.requiresSignIn, true);
  assert.ok(!JSON.stringify(body).includes('ticket'));
  assert.ok(h.calls.some((c) => JSON.stringify(c).includes('"p_user_id":"' + id + '"')));
  assert.ok(
    h.calls.some((c) => JSON.stringify(c).includes('"Authorization":"Bearer verified-token"')),
  );
  assert.ok(h.calls.some((c) => JSON.stringify(c) === '{"signOut":"temporary","scope":"local"}'));
  for (const [mode, code] of [
    ['shared', 'SHARED_CONNECTION'],
    ['stale', 'STALE_DATA'],
    ['pending', 'AUTH_STALE_OR_PENDING'],
  ]) {
    const failed = harness(mode);
    const result = await resetOwnPersonalData(request(), config, failed.factory);
    assert.equal(result.status, 409);
    assert.equal((await result.json()).code, code);
  }
});
