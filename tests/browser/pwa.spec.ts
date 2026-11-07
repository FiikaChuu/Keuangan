import { test, expect } from '@playwright/test';

test('share target consumes an image once in memory and does not cache the image or API responses', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'Safari does not implement Web Share Target reception.');
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  const result = await page.evaluate(async () => {
    const bytes = new Uint8Array(64);
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const form = new FormData();
    form.set('receipt', new File([bytes], 'nota.png', { type: 'image/png' }));
    const response = await fetch('/share', { method: 'POST', body: form });
    const id = new URL(response.url).searchParams.get('share');
    async function take() {
      return new Promise<{ bytes?: ArrayBuffer; error?: string }>((resolve, reject) => {
        const ch = new MessageChannel();
        const timer = setTimeout(() => reject(new Error('Share reply timed out')), 5000);
        ch.port1.onmessage = ({ data }) => {
          clearTimeout(timer);
          ch.port1.close();
          resolve(data);
        };
        navigator.serviceWorker.controller!.postMessage({ type: 'TAKE_SHARE', id }, [ch.port2]);
      });
    }
    const first = await take(),
      second = await take();
    const keys = await caches.keys();
    const urls = (
      await Promise.all(
        keys.map(async (key) => (await (await caches.open(key)).keys()).map((r) => r.url)),
      )
    ).flat();
    return {
      id,
      first: first.bytes ? [...new Uint8Array(first.bytes)] : null,
      second: second.error,
      urls,
      local: Object.keys(localStorage),
      databases: typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [],
    };
  });
  expect(result.id).toMatch(/^[\da-f-]{36}$/);
  expect(result.first?.slice(0, 8)).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(result.second).toBe('expired');
  expect(result.urls.some((url) => /\/api\/|\/share|share=/.test(url))).toBe(false);
  expect(result.databases.some((db) => db.name === 'skysave-receipts')).toBe(false);
});

test('manifest and document expose install metadata without a manual photo upload', async ({
  page,
}) => {
  await page.goto('/');
  const response = await page.request.get('/manifest.json');
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.share_target).toMatchObject({
    action: '/share',
    method: 'POST',
    enctype: 'multipart/form-data',
  });
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
    'content',
    'yes',
  );
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    'content',
    /viewport-fit=cover/,
  );
  await expect(page.getByRole('button', { name: 'Unggah bukti', exact: true })).toHaveCount(0);
  expect((await page.request.get('/api/scan-receipt')).status()).toBe(405);
});
