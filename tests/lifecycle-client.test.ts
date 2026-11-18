import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendLifecycle } from '../src/lifecycle-client';

test('lifecycle client requires explicit server confirmation, never HTTP status alone', async () => {
  const transport = (body: object, status = 200) =>
    (async () => Response.json(body, { status })) as typeof fetch;
  assert.equal(
    (
      await sendLifecycle(
        'delete',
        'token',
        'password',
        'HAPUS AKUN',
        undefined,
        transport({ message: 'ok' }),
      )
    ).complete,
    false,
  );
  assert.equal(
    (
      await sendLifecycle(
        'delete',
        'token',
        'password',
        'HAPUS AKUN',
        undefined,
        transport({ deleted: true }),
      )
    ).complete,
    true,
  );
  assert.equal(
    (
      await sendLifecycle(
        'reset',
        'token',
        'password',
        'RESET',
        undefined,
        transport({ reset: true }),
      )
    ).complete,
    false,
  );
  assert.equal(
    (
      await sendLifecycle(
        'reset',
        'token',
        'password',
        'RESET',
        undefined,
        transport({ code: 'RESET_COMPLETE', reset: true, requiresSignIn: true }),
      )
    ).complete,
    true,
  );
  assert.equal(
    (await sendLifecycle('reset', 'token', 'password', 'RESET', undefined, transport({}, 503)))
      .uncertain,
    true,
  );
});

test('reset retries preserve request identity and original revision without target identity', async () => {
  const bodies: object[] = [];
  const attempt = { requestId: 'a-fixed-id', revision: 'original-revision' };
  const transport = (async (url, options) => {
    assert.equal(url, '/api/account/reset');
    bodies.push(JSON.parse(String(options?.body)));
    return Response.json({ code: 'RESET_UNAVAILABLE' }, { status: 503 });
  }) as typeof fetch;
  for (let i = 0; i < 2; i++)
    await sendLifecycle('reset', 'token', 'password', 'RESET', attempt, transport);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.deepEqual(Object.keys(bodies[0]).sort(), [
    'confirmation',
    'password',
    'requestId',
    'revision',
  ]);
});

test('transport failure propagates rather than reporting completion', async () => {
  await assert.rejects(
    sendLifecycle('reset', 'token', 'password', 'RESET', undefined, (async () => {
      throw new Error('offline');
    }) as typeof fetch),
    /offline/,
  );
});
