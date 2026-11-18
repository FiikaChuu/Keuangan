import { test, expect } from '@playwright/test';
import { emptyStore } from '../../src/domain';

test('scoped wallet correction retains controls at the approved 440px fixture', async ({ page }) => {
  await page.setViewportSize({ width: 440, height: 1000 });
  await page.goto('/');
  const store = emptyStore();
  store.accounts = [
    { id: 'fixture-bca', name: 'Utama', provider: 'BCA', opening: 14000, shared: false, color: '#a78bfa', suffix: '1234' },
    { id: 'fixture-cash', name: 'Tunai', provider: 'Tunai', opening: 1, shared: false, color: '#c4b5fd', suffix: '' },
  ];
  await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), store);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
  const card = page.locator('.wallet-command');
  await expect(card.locator('.money-amount')).toHaveAttribute('title', 'Rp 14.001');
  const bounds = await card.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { width: r.width, height: r.height, weight: getComputedStyle(el.querySelector('.money-number')!).fontWeight,
      contained: [...el.querySelectorAll('.orb-controls button')].every((button) => {
        const b = button.getBoundingClientRect();
        return b.left >= r.left && b.right <= r.right && b.top >= r.top && b.bottom <= r.bottom;
      }) };
  });
  expect(bounds.width).toBe(400);
  expect(bounds.height).toBeCloseTo(239.52, 1);
  expect(bounds.weight).toBe('750');
  expect(bounds.contained).toBe(true);
  await expect(page.locator('.wallet-home-heading').getByRole('button', { name: 'Tambah dompet', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Catat transaksi baru', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: /Tambah dompet/ })).toBeVisible();
  await expect(card.getByRole('button', { name: /Riwayat/ })).toBeVisible();
  await expect(page.locator('.wallet-quick-actions button')).toHaveCount(4);
  const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
  await expect(nav.locator('.nav-primary button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Catat transaksi', exact: true })).toBeVisible();
  await card.getByRole('button', { name: /Tambah dompet/ }).click();
  const avatar = page.locator('.provider-picker-trigger > .provider-mark');
  const square = await avatar.boundingBox();
  expect(square?.width).toBe(44);
  expect(square?.height).toBe(44);
  await page.keyboard.press('Escape');
  await nav.getByRole('button', { name: 'Pengaturan', exact: true }).click();
  await expect(page.locator('.appearance-settings')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Catat transaksi', exact: true })).toBeVisible();
  await expect(page.getByText('Tampilan dan preferensi aplikasi.', { exact: true })).toBeVisible();
});
