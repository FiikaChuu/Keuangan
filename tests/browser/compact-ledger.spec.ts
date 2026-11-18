import { test, expect } from '@playwright/test';
import { emptyStore, demoStore } from '../../src/domain';
import { mkdir } from 'node:fs/promises';

test('compact physical card and clear ledger actions at mobile scroll positions', async ({
  page,
}, info) => {
  const dir = 'output/playwright/compact-ledger';
  await mkdir(dir, { recursive: true });
  await page.goto('/');
  const data = emptyStore();
  data.accounts = [14000, 1].map((opening, i) => ({
    id: `fixture-${i}`,
    provider: 'Tunai',
    name: i ? 'Cadangan' : 'Harian',
    opening,
    color: '#ffba58',
    shared: false,
    suffix: '',
  }));
  await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), data);
  await page.reload();
  await expect(page.locator('.wallet-command')).toBeVisible();
  for (const width of [390, 440, 1440]) {
    await page.setViewportSize({ width, height: 956 });
    const geometry = await page.locator('.wallet-command').evaluate((el) => {
      const c = el.getBoundingClientRect();
      const a = el.querySelector('.wallet-texture')!.getBoundingClientRect();
      const b = el.querySelector('.figma-balance-amount')!.getBoundingClientRect();
      return { width: c.width, height: c.height, balanceRight: b.right, artLeft: a.left };
    });
    expect(geometry.height).toBeLessThanOrEqual(geometry.width / 1.5);
    expect(geometry.balanceRight).toBeLessThanOrEqual(geometry.artLeft);
    await expect(page.locator('.orb-controls button')).toHaveCount(1);
    await expect(page.locator('.figma-balance-amount')).toContainText('14.001');
    await page.screenshot({
      path: `${dir}/${info.project.name}-home-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 440, height: 956 });
  await page.locator('.orb-controls button').click();
  await expect(page.locator('.ledger-panel')).toBeVisible();
  await page.screenshot({
    path: `${dir}/${info.project.name}-transactions-empty-440.png`,
    fullPage: true,
  });
  const input = page.getByLabel('Cari nama, kategori, atau sumber transaksi');
  await input.fill('tidak ditemukan');
  expect(await input.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('none');
  expect(
    await page.locator('.search-field').evaluate((el) => getComputedStyle(el).outlineStyle),
  ).toBe('solid');
  await page.screenshot({
    path: `${dir}/${info.project.name}-transactions-focused-440.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Hapus pencarian', exact: true }).click();
  await expect(input).toHaveValue('');
  await page.getByRole('button', { name: 'Filter lanjutan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Filter lanjutan' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter lanjutan', exact: true }).click();
  for (const state of ['empty', 'populated']) {
    if (state === 'populated') {
      await page.evaluate(
        (data) => localStorage.setItem('skysave.v1', JSON.stringify(data)),
        demoStore(),
      );
      await page.reload();
      await expect(page.locator('.ledger-footer')).toBeAttached();
    }
    for (const width of [390, 440]) {
      await page.setViewportSize({ width, height: 844 });
      const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      for (let y = 0; y <= max + 40; y += 40) {
        await page.evaluate((y) => scrollTo(0, y), y);
        const overlap = await page.evaluate(() => {
          const a = document.querySelector('.capture-button')!.getBoundingClientRect();
          const b = document.querySelector('.ledger-footer > .btn')!.getBoundingClientRect();
          return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        });
        expect(overlap, `${state} ${width}px scroll ${y}`).toBe(false);
      }
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Ekspor hasil CSV', exact: true }).click();
      expect((await download).suggestedFilename()).toMatch(/skywallet-transaksi.*csv/);
    }
  }
});
