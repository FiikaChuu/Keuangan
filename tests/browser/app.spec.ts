import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { today } from '../../src/domain';

async function navigate(page: Page, name: string) {
  const nav =
    page.viewportSize()!.width <= 800
      ? page.getByRole('navigation', { name: 'Navigasi mobile' })
      : page.getByRole('navigation', { name: 'Navigasi utama' });
  await nav.getByRole('button', { name, exact: true }).click();
}
async function ownAccount(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mulai dengan data saya' }).click();
  await page.getByRole('button', { name: 'Ya, lanjutkan' }).click();
  await page.getByLabel('Nama dompet').fill('Harian');
  await page.getByLabel('Saldo awal').fill('5000000');
  await page.getByRole('button', { name: 'Tambahkan dompet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
test('dashboard renders without errors and navigation fits the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Lebih tenang, lebih terencana.' })).toBeVisible();
  await expect(page.getByText('data contoh', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: /Grafik total saldo/ })).toBeVisible();
  for (const [desktop, mobile, heading] of [
    ['Dompet saya', 'Dompet', 'Uangmu, di satu tempat.'],
    ['Transaksi', 'Riwayat', 'Semua jejak, satu cerita.'],
    ['Rencana uang', 'Rencana', 'Pemasukan berubah. Tujuan tetap.'],
    ['Ruang bersama', 'Bersama', 'Untuk cerita kita.'],
  ]) {
    await navigate(page, page.viewportSize()!.width <= 800 ? mobile : desktop);
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
  expect(errors).toEqual([]);
});
test('real-data flow: irregular income, expense, shared transfer and persistence', async ({
  page,
}) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
  await page.getByRole('button', { name: 'Pemasukan', exact: true }).last().click();
  await page.getByLabel('Nama transaksi').fill('Komisi desain');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('750000');
  await page.getByLabel('Asal pemasukan').fill('Klien tidak tetap');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
  await page.getByLabel('Nama transaksi').fill('Tarik untuk tunai');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('200000');
  await page.getByLabel('Kategori', { exact: true }).selectOption('Tarik tunai');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Bersama' : 'Ruang bersama');
  await page.getByRole('button', { name: 'Akun bersama', exact: true }).click();
  await page.getByLabel('Bank atau e-wallet').selectOption('Bank Jago');
  await page.getByLabel('Nama dompet').fill('Tabungan kita');
  await page.getByLabel('Saldo awal').fill('0');
  await page.getByRole('button', { name: 'Tambahkan dompet', exact: true }).click();
  await page.getByRole('button', { name: 'Catat penambahan dana' }).click();
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('500000');
  await page.getByLabel('Biaya admin').fill('2500');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.demo).toBe(false);
  expect(state.accounts).toHaveLength(2);
  expect(state.transactions).toHaveLength(3);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await expect(page.getByText('Rp 202.500', { exact: true })).toBeVisible();
  await page.getByLabel('Cari nama, kategori, atau sumber transaksi').fill('Klien tidak tetap');
  await expect(page.getByRole('button', { name: /Komisi desain/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Tarik untuk tunai/ })).toHaveCount(0);
});
test('planning persists a 100 percent allocation and protects required obligations', async ({
  page,
}) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Rencana' : 'Rencana uang');
  await page.getByLabel('Kebutuhan wajib yang belum dibayar').fill('2000000');
  await page.getByRole('button', { name: 'Simpan rencana', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simpan rencana', exact: true })).toBeDisabled();
  await expect(page.getByText('Rp 3.000.000', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Persentase Untuk future you').fill('60');
  await page.getByRole('button', { name: 'Simpan rencana', exact: true }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.plan.saving).toBe(60);
  expect(state.plan.fun + state.plan.saving + state.plan.together).toBe(100);
  await page.getByLabel('Kebutuhan wajib yang belum dibayar').fill('6000000');
  await expect(page.getByText(/Dana belum cukup untuk cadangan wajib/)).toBeVisible();
});
test('local OCR reads an actual image, stores proof and blocks duplicate upload', async ({
  page,
}) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Unggah bukti', exact: true }).click();
  const date = today().split('-').reverse().join('/');
  const data = await page.evaluate((date) => {
    const c = document.createElement('canvas');
    c.width = 1100;
    c.height = 650;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111';
    ctx.font = '36px monospace';
    [
      'SeaBank',
      'Sumber dana: SeaBank',
      'Total transfer Rp 125.000',
      'No referensi REF12345',
      date,
      'Kopi dan makanan',
    ].forEach((s, i) => ctx.fillText(s, 65, 90 + i * 80));
    return c.toDataURL('image/png').split(',')[1];
  }, date);
  const file = {
    name: 'seabank-bukti.png',
    mimeType: 'image/png',
    buffer: Buffer.from(data, 'base64'),
  };
  await page.locator('.upload-zone input').setInputFiles(file);
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('125000', {
    timeout: 60000,
  });
  await expect(
    page.getByText('Bukti selesai dibaca. Periksa dan lengkapi hasilnya.'),
  ).toBeVisible();
  await page.getByLabel('Nama transaksi').fill('Kopi dari bukti');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Kopi dari bukti/ }).click();
  await expect(page.getByAltText('Bukti Kopi dari bukti')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await page.getByRole('button', { name: 'Unggah bukti', exact: true }).click();
  await page.locator('.upload-zone input').setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('Bukti ini sudah tercatat');
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await page.getByRole('button', { name: 'Buka pengaturan' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh cadangan lengkap' }).click();
  const backupPath = await (await downloadPromise).path();
  await page.locator('.file-action input').setInputFiles(backupPath!);
  await expect(page.getByText('Pulihkan 1 transaksi dan 1 rekening?')).toBeVisible();
  await page.getByRole('button', { name: 'Ganti & pulihkan' }).click();
  await expect(page.getByText('Pulihkan 1 transaksi dan 1 rekening?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await page.getByRole('button', { name: /Kopi dari bukti/ }).click();
  await expect(page.getByAltText('Bukti Kopi dari bukti')).toBeVisible();
});
test('PDF text extraction proposes amount and source for review', async ({ page }) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Unggah bukti', exact: true }).click();
  const text =
    'BT /F1 20 Tf 50 740 Td (SeaBank) Tj 0 -40 Td (Sumber dana: SeaBank) Tj 0 -40 Td (Total pembayaran Rp 225.000) Tj 0 -40 Td (No referensi PDF12345) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n \n`)
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  await page
    .locator('.upload-zone input')
    .setInputFiles({ name: 'receipt.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdf) });
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('225000');
  await expect(page.getByLabel('No. referensi')).toHaveValue('PDF12345');
  await expect(page.getByText(/Sumber terindikasi SeaBank/)).toBeVisible();
  await page.getByLabel('Nama transaksi').fill('Pembayaran via PDF');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('complete backup, restore confirmation, and offline launch', async ({ page, context }) => {
  await ownAccount(page);
  await page.getByRole('button', { name: 'Buka pengaturan' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh cadangan lengkap' }).click();
  const backup = await downloadPromise;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.locator('.file-action input').setInputFiles(path!);
  await expect(page.getByText('Pulihkan 0 transaksi dan 1 rekening?')).toBeVisible();
  await page.getByRole('button', { name: 'Ganti & pulihkan' }).click();
  await expect(page.getByText('Pulihkan 0 transaksi dan 1 rekening?')).toHaveCount(0);
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Lebih tenang, lebih terencana.' })).toBeVisible();
  await expect(page.getByText('Rp 5.000.000', { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});
