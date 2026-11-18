import { test, expect } from '@playwright/test';
import { emptyStore } from '../../src/domain';
test('empty wallet deletion confirms, removes and persists; funded wallet is blocked', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), {
    ...emptyStore(),
    accounts: [
      {
        id: 'empty-wallet',
        name: 'Kosong',
        provider: 'Tunai',
        opening: 0,
        shared: false,
        color: '#123456',
        suffix: '',
      },
      {
        id: 'funded-wallet',
        name: 'Berisi',
        provider: 'Tunai',
        opening: 100,
        shared: false,
        color: '#123456',
        suffix: '',
      },
    ],
  });
  await page.goto('/dompet');
  await page.getByRole('button', { name: 'Hapus dompet Berisi', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('tanpa saldo');
  await page.getByRole('button', { name: 'Hapus dompet Kosong', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Tidak ada riwayat');
  await page.getByRole('button', { name: 'Ya, lanjutkan' }).click();
  await expect(page.getByRole('button', { name: 'Hapus dompet Kosong', exact: true })).toHaveCount(
    0,
  );
  await page.reload();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!).accounts.length),
  ).toBe(1);
});
