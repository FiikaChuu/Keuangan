import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../app/api/scan-receipt/route';
import { MAX_SCAN_BYTES } from '../src/scan-contract';

test('receipt route verifies login and whitelist, uses Gemini structured output, and never writes images', async (suite) => {
  const originalFetch = globalThis.fetch;
  const env = { ...process.env };
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://scan-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'public-test-key';
  process.env.GEMINI_API_KEY = 'server-only-test-secret';
  let auth = true,
    rate = false,
    calls: string[] = [];
  let output: Record<string, unknown> = {
    category: 'Transfer',
    amount: 102500,
    is_transfer: true,
    from_bank: 'BCA',
    to_bank: 'Mandiri',
    notes: 'Biaya admin Rp2.500',
  };
  const png = new Uint8Array(64);
  png.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const request = (body: Uint8Array = png, headers: Record<string, string> = {}) =>
    new Request('http://localhost/api/scan-receipt', {
      method: 'POST',
      headers: {
        authorization: 'Bearer verified-test-token',
        'content-type': 'image/png',
        ...headers,
      },
      body,
    });
  globalThis.fetch = async (input, options) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push(url);
    if (url.endsWith('/auth/v1/user'))
      return Response.json(
        auth
          ? { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'a@example.com' }
          : { message: 'Invalid token' },
        { status: auth ? 200 : 401 },
      );
    if (url.endsWith('/rest/v1/rpc/reserve_receipt_scan')) {
      assert.equal(String(options?.body), '{}');
      return rate
        ? Response.json({ code: '54000', message: 'Batas pembacaan' }, { status: 400 })
        : new Response(null, { status: 204 });
    }
    assert.match(
      url,
      /generativelanguage\.googleapis\.com\/.*models\/gemini-2\.5-flash:generateContent/,
    );
    const body = JSON.parse(String(options?.body));
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, 'image/png');
    assert.equal(body.contents[0].parts[1].inlineData.data, Buffer.from(png).toString('base64'));
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.deepEqual(body.generationConfig.responseSchema.properties.category.enum, [
      'Makan',
      'Belanja',
      'Pendidikan',
      'Transportasi',
      'Tagihan',
      'Transfer',
      'Lainnya',
    ]);
    return Response.json({
      candidates: [
        {
          content: { parts: [{ text: JSON.stringify(output) }], role: 'model' },
          finishReason: 'STOP',
        },
      ],
    });
  };
  try {
    await suite.test('no token and unverified token cannot spend model quota', async () => {
      calls = [];
      assert.equal((await POST(request(png, { authorization: '' }))).status, 401);
      assert.equal(calls.length, 0);
      auth = false;
      assert.equal((await POST(request())).status, 401);
      assert.equal(calls.length, 1);
      auth = true;
    });
    await suite.test(
      'invalid MIME, oversize and disguised files are rejected before inference',
      async () => {
        for (const req of [
          request(png, { 'content-type': 'text/html' }),
          request(png, { 'content-length': String(MAX_SCAN_BYTES + 1) }),
          request(new TextEncoder().encode('<svg onload="evil()"></svg>')),
        ]) {
          calls = [];
          assert.ok([413, 415].includes((await POST(req)).status));
          assert.equal(calls.length, 1);
        }
        calls = [];
        assert.equal((await POST(request(new Uint8Array(MAX_SCAN_BYTES + 1)))).status, 413);
        assert.equal(calls.length, 1);
      },
    );
    await suite.test(
      'database quota check cannot be bypassed by a different serverless instance',
      async () => {
        rate = true;
        calls = [];
        assert.equal((await POST(request())).status, 429);
        assert.equal(calls.length, 2);
        rate = false;
      },
    );
    await suite.test(
      'official SDK receives only the in-memory image and constrained schema',
      async () => {
        calls = [];
        const response = await POST(request());
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), output);
        assert.equal(calls.length, 3);
        assert.ok(!calls.some((url) => /storage\/|\/transactions|\/wallets/.test(url)));
      },
    );
    await suite.test(
      'unreadable or inconsistent model output never becomes a financial record',
      async () => {
        output = { ...output, amount: 0 };
        assert.equal((await POST(request())).status, 422);
        output = { ...output, amount: 10000, category: 'Makan' };
        assert.equal((await POST(request())).status, 422);
        output = { ...output, category: 'Transfer', injected: 'unexpected' };
        assert.equal((await POST(request())).status, 422);
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'GEMINI_API_KEY',
    ])
      if (env[key] === undefined) delete process.env[key];
      else process.env[key] = env[key];
  }
});
