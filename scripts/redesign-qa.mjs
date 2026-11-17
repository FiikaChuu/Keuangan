import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const output = 'test-results/redesign';
const baseURL = process.env.REDESIGN_BASE_URL || 'http://127.0.0.1:4183';
await mkdir(output, { recursive: true });
const failures = [];
const results = [];
const routes = [
  '/',
  '/dompet',
  '/expenses',
  '/expenses#laporan',
  '/rencana-uang',
  '/ruang-bersama',
  '/settings',
];
try {
  for (const width of [320, 390, 768, 1024, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: 'block',
      locale: 'id-ID',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => failures.push(error.message));
    for (const route of routes) {
      await page.goto(`${baseURL}${route}`);
      await page.locator('.app-navigation').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (route.includes('#laporan')) {
        await page.locator('.skip-link').focus();
        await page.keyboard.press('Enter');
        assert.equal(new URL(page.url()).hash, '#laporan');
        assert.equal(
          await page.locator('main').evaluate((el) => el === document.activeElement),
          true,
        );
      }
      const overflow = await page.evaluate(() => ({
        width: innerWidth,
        document: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll('main *, .app-navigation')]
          .filter(
            (el) =>
              el.getBoundingClientRect().right > innerWidth + 1 &&
              el.getBoundingClientRect().width > 1,
          )
          .map((el) => el.className?.baseVal ?? el.className)
          .slice(0, 15),
      }));
      if (overflow.document > width) failures.push({ route, width, overflow });
      results.push({ route, width, overflow: overflow.document > width });
      if (width === 390 || width === 1440)
        await page.screenshot({
          path: `${output}/${width}-${route.replaceAll('/', '').replace('#', '-') || 'dashboard'}.png`,
          fullPage: true,
        });
    }
    await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
    await page.getByRole('dialog', { name: 'Catat transaksi' }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).count(),
      1,
    );
    assert.equal(await page.getByLabel('Pindai nota', { exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: /^Detail tambahan/ }).click();
    await page.getByLabel('Catatan (opsional)').fill('Pemeriksaan tampilan');
    assert.equal(
      await page.locator('.modal-form-content').evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      `form at ${width}`,
    );
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `${output}/${width}-form.png` });
    await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
    await page.getByRole('option', { name: 'Transfer', exact: true }).click();
    await page.getByRole('button', { name: 'Ke bank/akun', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Gelap', exact: true }).click();
    await page.getByRole('button', { name: 'Ringkasan', exact: true }).click();
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `${output}/${width}-dark.png`, fullPage: true });
    await page.evaluate(() => {
      localStorage.setItem(
        'skysave.v1',
        JSON.stringify({
          version: 1,
          demo: false,
          accounts: [],
          transactions: [],
          goals: [],
          plan: { reserve: 0, saving: 50, fun: 30, together: 20 },
        }),
      );
      localStorage.setItem('skysave.theme', 'light');
    });
    await page.reload();
    await page.locator('.dashboard-start').waitFor();
    assert.equal(await page.locator('.donut, .figma-insight-card').count(), 0);
    if (width === 390 || width === 1440)
      await page.screenshot({ path: `${output}/${width}-empty.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(
      await page
        .locator('.figma-balance-amount')
        .evaluate((el) => getComputedStyle(el).animationName),
      'none',
    );
    await context.close();
  }
  await writeFile(`${output}/results.json`, JSON.stringify({ results, failures }, null, 2));
  console.log(JSON.stringify({ viewports: 5, routes: results.length, failures }, null, 2));
  assert.equal(failures.length, 0);
} finally {
  await browser.close();
}
