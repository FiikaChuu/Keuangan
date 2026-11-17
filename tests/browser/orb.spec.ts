import { test, expect } from '@playwright/test';
import { emptyStore, demoStore } from '../../src/domain';
import { mkdir } from 'node:fs/promises';

test('Orb visual fixtures and real card actions', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const dir = 'output/playwright/orb';
  await mkdir(dir, { recursive: true });
  for (const state of ['funded-empty', 'populated']) {
    const data =
      state === 'populated'
        ? demoStore()
        : {
            ...emptyStore(),
            accounts: [
              {
                id: 'fixture-wallet',
                provider: 'Tunai',
                name: 'Harian',
                opening: 14000,
                color: '#ffba58',
                shared: false,
                suffix: '',
              },
            ],
          };
    await page.goto('/');
    await page.evaluate((data) => {
      localStorage.setItem('skysave.v1', JSON.stringify(data));
      localStorage.setItem('skysave.theme', 'light');
    }, data);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(await page.locator('.wallet-command').evaluate((el) => getComputedStyle(el).color)).toBe(
      'rgb(17, 17, 17)',
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    if (state === 'funded-empty')
      await expect(page.locator('.figma-balance-amount')).toContainText('14.000');
    await page.screenshot({ path: `${dir}/${info.project.name}-${state}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Catat transaksi baru', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Catat transaksi' })).toBeVisible();
    await page.getByRole('button', { name: 'Tutup dialog' }).click();
    await page.locator('.orb-controls').getByRole('button', { name: 'Tambah dompet' }).click();
    await expect(page.getByLabel('Nama dompet')).toBeVisible();
    await page.getByRole('button', { name: 'Tutup dialog' }).click();
    await page.getByRole('button', { name: 'Sembunyikan saldo' }).click();
    await expect(page.locator('.figma-balance-amount')).toContainText('••');
    await page.getByRole('button', { name: 'Tampilkan saldo' }).click();
  }
  expect(errors).toEqual([]);
});
