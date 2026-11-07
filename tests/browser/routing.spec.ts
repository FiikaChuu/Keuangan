import { test, expect } from '@playwright/test';

test('page URLs survive reload and browser back restores navigation', async ({ page }) => {
  for (const [path, heading] of [
    ['/dompet', 'Dompet'],
    ['/settings', 'Pengaturan'],
    ['/expenses', 'Transaksi'],
    ['/rencana-uang', 'Rencana uang'],
    ['/ruang-bersama', 'Ruang bersama'],
    ['/expenses#laporan', 'Laporan'],
  ]) {
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigasi utama' })).toBeVisible();
  }
  await page.goto('/');
  await page
    .getByRole('navigation')
    .getByRole('button', { name: 'Dompet saya', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dompet$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
});
