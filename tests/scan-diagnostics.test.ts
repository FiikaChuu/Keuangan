import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/scan-receipt/route';

// Synthetic signatures only. No receipt, credentials, database or model is contacted.
test('scanner exposes bounded diagnostics without upstream text or financial data', async () => {
  const originalFetch = globalThis.fetch;
  const keys = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'GEMINI_API_KEY',
  ] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://diagnostics-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'synthetic-public-key';
  process.env.GEMINI_API_KEY = 'synthetic-model-key';
  let reply = () => Response.json({});
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith('/auth/v1/user'))
      return Response.json({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    if (url.endsWith('/rest/v1/rpc/reserve_receipt_scan'))
      return new Response(null, { status: 204 });
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\//);
    return reply();
  };
  const output = {
    category: 'Belanja',
    amount: 10000,
    is_transfer: false,
    from_bank: null,
    to_bank: null,
    notes: null,
  };
  const candidate = (text: string, finishReason: string) => ({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason }],
  });
  async function scan() {
    const png = new Uint8Array(64);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    return POST(
      new Request('http://localhost/api/scan-receipt', {
        method: 'POST',
        headers: { authorization: 'Bearer synthetic-token', 'content-type': 'image/png' },
        body: png,
      }),
    );
  }
  try {
    reply = () =>
      Response.json(
        {
          error: {
            code: 404,
            message: 'PRIVATE model unavailable account secret',
            status: 'NOT_FOUND',
          },
        },
        { status: 404 },
      );
    const missing = await scan();
    assert.equal(missing.status, 503);
    assert.deepEqual((await missing.json()).diagnostic, {
      reason: 'MODEL_UNAVAILABLE',
      upstreamStatus: 404,
    });
    for (const [payload, reason] of [
      [{ promptFeedback: { blockReason: 'SAFETY' } }, 'BLOCKED'],
      [candidate(JSON.stringify(output), 'MAX_TOKENS'), 'INCOMPLETE_OUTPUT'],
      [candidate('PRIVATE invalid json', 'STOP'), 'INVALID_JSON'],
      [candidate(JSON.stringify({ ...output, amount: 0 }), 'STOP'), 'AMOUNT_UNREADABLE'],
      [candidate(JSON.stringify({ ...output, is_transfer: true }), 'STOP'), 'INVALID_SCHEMA'],
      [{}, 'EMPTY_RESPONSE'],
      [candidate(JSON.stringify(output), 'PRIVATE_UNKNOWN_REASON'), 'INCOMPLETE_OUTPUT'],
    ] as const) {
      reply = () => Response.json(payload);
      const response = await scan();
      assert.equal(response.status, 422);
      const body = await response.json();
      assert.equal(body.code, 'SCAN_UNREADABLE');
      assert.deepEqual(body.diagnostic, { reason });
      assert.doesNotMatch(JSON.stringify(body), /PRIVATE|synthetic|10000/);
    }
    reply = () => Response.json(candidate(JSON.stringify(output), 'STOP'));
    assert.deepEqual(await (await scan()).json(), output);
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
