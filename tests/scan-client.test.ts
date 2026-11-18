import test from 'node:test';
import assert from 'node:assert/strict';
import { scanImage } from '../src/share';

// Synthetic upload and HTTP replies; no external inference or private image.
test('scan client distinguishes service/session failures from unreadable images without leaking replies', async () => {
  const original = globalThis.fetch;
  const file = new File([new Uint8Array(64)], 'synthetic.png', { type: 'image/png' });
  try {
    for (const [status, body, expected] of [
      [401, { error: 'PRIVATE token' }, /Sesi berakhir.*HTTP_401/],
      [403, { error: 'PRIVATE account' }, /Akun tidak memiliki akses.*HTTP_403/],
      [429, { error: 'PRIVATE quota' }, /Batas pembacaan.*HTTP_429/],
      [503, { code: 'SCAN_UPSTREAM_AUTH', error: 'PRIVATE key' }, /mengautentikasi.*SCAN_UPSTREAM_AUTH/],
      [503, { code: 'SCAN_MODEL_UNAVAILABLE' }, /Model pembaca nota tidak tersedia.*SCAN_MODEL_UNAVAILABLE/],
      [429, { code: 'SCAN_UPSTREAM_QUOTA' }, /Kuota layanan.*SCAN_UPSTREAM_QUOTA/],
      [422, { code: 'SCAN_UNREADABLE', diagnostic: { reason: 'AMOUNT_UNREADABLE' } }, /Nominal.*SCAN_UNREADABLE\/AMOUNT_UNREADABLE/],
      [422, { code: 'SCAN_UNREADABLE', diagnostic: { reason: 'INCOMPLETE_OUTPUT' } }, /belum selesai.*INCOMPLETE_OUTPUT/],
      [502, { code: 'PRIVATE', diagnostic: { reason: 'PRIVATE' }, error: 'PRIVATE' }, /Layanan pembaca nota.*HTTP_502/],
    ] as const) {
      globalThis.fetch = async () => Response.json(body, { status });
      await assert.rejects(scanImage(file, 'synthetic-token', new AbortController().signal), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, expected);
        assert.doesNotMatch(error.message, /PRIVATE|synthetic/);
        return true;
      });
    }
    globalThis.fetch = async () => new Response('<html>PRIVATE gateway</html>', { status: 502 });
    await assert.rejects(scanImage(file, 'synthetic-token', new AbortController().signal), /Layanan pembaca nota.*HTTP_502/);
  } finally {
    globalThis.fetch = original;
  }
});
