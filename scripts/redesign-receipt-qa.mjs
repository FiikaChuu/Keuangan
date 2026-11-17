import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';

// Browser-only fixtures: every Auth/RPC/scan response is intercepted. No real
// credentials, Gemini requests, remote records or database writes are involved.
const baseURL = process.env.REDESIGN_LOGIN_URL || 'http://127.0.0.1:4186';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'receipt-ui@example.invalid', role: 'authenticated', aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated' })}.local-ui-fixture`;
  const snapshot = { allowed: true, revision: '1', wallets: [{ id: '00000000-0000-4000-8000-000000000002', name: 'Dompet uji UI', provider: 'SeaBank', color: '#f97316', suffix: '', opening_balance: 100000, household_id: null, version: 1 }], transactions: [], goals: [], plan: { reserve: 0, saving: 50, fun: 30, together: 20, version: 1 } };
  let mode = 'error';
  let resolvePending;
  let commits = 0;
  let scanCalls = 0;
  await context.routeWebSocket('**', (socket) => socket.close());
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/auth/v1/token') return json({ access_token: token, refresh_token: 'local-ui-fixture', expires_in: 3600, token_type: 'bearer', user });
    if (url.pathname === '/auth/v1/user') return json(user);
    if (url.pathname.endsWith('/rpc/bootstrap_finance')) return json(null);
    if (url.pathname.endsWith('/rpc/finance_snapshot')) return json(snapshot);
    if (url.pathname.endsWith('/rpc/finance_revision')) return json({ allowed: true, revision: '1' });
    if (url.pathname.endsWith('/rpc/commit_finance')) { commits++; return json(null); }
    if (url.pathname === '/api/scan-receipt') {
      scanCalls++;
      if (mode === 'pending') {
        await new Promise((resolve) => { resolvePending = resolve; });
        try { await route.abort(); } catch { /* Cancellation already aborted this request. */ }
        return;
      }
      if (mode === 'error') return json({ error: 'Foto uji belum dapat dibaca.' }, 422);
      return json({ category: 'Makan', amount: 25000, is_transfer: false, from_bank: null, to_bank: null, notes: 'Hasil pindai uji UI' });
    }
    if (url.origin !== new URL(baseURL).origin) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(baseURL);
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Kata sandi', { exact: true }).fill('local-fixture-only');
  await page.getByRole('button', { name: 'Masuk', exact: true }).click();
  await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('12000');
  const picker = page.getByLabel('Pindai nota', { exact: true });
  assert.equal(await picker.isEnabled(), true);
  const fixture = { name: 'fixture.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) };
  await picker.setInputFiles(fixture);
  const failure = page.getByRole('dialog', { name: 'Nota belum terbaca', exact: true });
  await failure.waitFor();
  await expect(failure).toContainText('Foto uji belum dapat dibaca.');
  await page.screenshot({ path: 'test-results/redesign/390-scan-error.png' });
  await failure.getByRole('button', { name: 'Tutup', exact: true }).click();
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('12000');
  mode = 'pending';
  await picker.setInputFiles(fixture);
  const pending = page.getByRole('dialog', { name: 'Membaca nota', exact: true });
  await pending.waitFor();
  await pending.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  resolvePending?.();
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('12000');
  mode = 'success';
  await picker.setInputFiles(fixture);
  await expect(page.getByLabel('Total terdebet (Rp)', { exact: true })).toHaveValue('25000');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog')).toContainText('Periksa hasil baca nota sebelum menyimpan.');
  await expect(page.getByLabel('Catatan (opsional)')).toHaveValue('Hasil pindai uji UI');
  await page.screenshot({ path: 'test-results/redesign/390-scan-review.png' });
  assert.equal(commits, 0, 'Scan must not save a transaction before user confirmation');
  assert.equal(scanCalls, 3);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ mockedReceiptError: true, cancellationKeepsDraft: true, successOpensReview: true, automaticWrites: commits, pageErrors: errors }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
