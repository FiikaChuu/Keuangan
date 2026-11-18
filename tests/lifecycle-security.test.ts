import test from 'node:test';
import assert from 'node:assert/strict';
import { readLifecycleBody, limitedReauth } from '../src/lifecycle-security';
import type { SupabaseClient } from '@supabase/supabase-js';
test('streamed body is bounded without trusting content-length', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(8193));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readLifecycleBody(
      new Request('https://test.invalid', {
        method: 'POST',
        body: stream,
        duplex: 'half',
      } as RequestInit),
    ),
    /too large/,
  );
  assert.equal(cancelled, true);
});
test('stalled body cancels in three seconds before Auth work', async () => {
  let cancelled = false;
  const start = Date.now();
  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readLifecycleBody(
      new Request('https://test.invalid', {
        method: 'POST',
        body: stream,
        duplex: 'half',
      } as RequestInit),
    ),
    /timeout/,
  );
  assert.ok(Date.now() - start >= 2900 && Date.now() - start < 4500);
  assert.equal(cancelled, true);
});
test('failed password call consumes lease and releases exact token even on throw', async () => {
  const calls: unknown[] = [];
  const admin = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: '11111111-1111-4111-8111-111111111111', error: null };
    },
  } as unknown as SupabaseClient;
  const verifier = {
    auth: {
      signInWithPassword: async () => {
        throw Error('transport');
      },
    },
  } as unknown as SupabaseClient;
  await assert.rejects(
    limitedReauth(admin, verifier, { id: 'verified', email: 'verified@test.invalid' }, 'synthetic'),
    /transport/,
  );
  assert.deepEqual(calls, [
    { name: 'acquire_lifecycle_reauth', args: { p_user_id: 'verified' } },
    {
      name: 'release_lifecycle_reauth',
      args: { p_user_id: 'verified', p_lease: '11111111-1111-4111-8111-111111111111' },
    },
  ]);
});
