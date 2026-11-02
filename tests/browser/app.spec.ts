import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { today, demoStore } from '../../src/domain';

async function navigate(page: Page, name: string) {
  const mobile = page.viewportSize()!.width <= 800;
  const aliases: Record<string, string> = {
    Riwayat: 'Transaksi',
    Dompet: 'Dompet saya',
    Beranda: 'Ringkasan',
    Rencana: 'Rencana uang',
    Bersama: 'Ruang bersama',
    Setelan: 'Pengaturan',
  };
  name = aliases[name] ?? name;
  const nav = page.getByRole('navigation', {
    name: mobile ? 'Navigasi mobile' : 'Navigasi utama',
  });
  if (mobile && ['Rencana uang', 'Ruang bersama'].includes(name)) {
    await nav.getByRole('button', { name: 'Dompet saya', exact: true }).click();
    await page.locator('.wallet-tools').getByRole('button', { name, exact: true }).click();
  } else {
    await nav.getByRole('button', { name, exact: true }).click();
  }
}
async function uploadProof(page: Page) {
  const upload = page.getByRole('button', { name: 'Unggah bukti', exact: true });
  if (await upload.isVisible()) await upload.click();
  else {
    await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
    await page.getByRole('button', { name: 'Dari bukti transaksi', exact: true }).click();
  }
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
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.locator('.dashboard-demo-mobile:visible, .demo-banner:visible')).toHaveCount(1);
  await expect(page.getByRole('img', { name: /Grafik total saldo/ })).toBeVisible();
  for (const [desktop, mobile, heading] of [
    ['Dompet saya', 'Dompet', 'Dompet'],
    ['Transaksi', 'Riwayat', 'Transaksi'],
    ['Rencana uang', 'Rencana', 'Rencana uang'],
    ['Ruang bersama', 'Bersama', 'Ruang bersama'],
    ['Laporan', 'Laporan', 'Laporan'],
    ['Pengaturan', 'Pengaturan', 'Pengaturan'],
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
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Tarik tunai' }).click();
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
  await expect(page.getByRole('button', { name: /^Lihat transaksi Komisi desain/ })).toBeVisible();
  await expect(
    page.getByRole('button', { name: /^Lihat transaksi Tarik untuk tunai/ }),
  ).toHaveCount(0);
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
  await uploadProof(page);
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
  await page.getByRole('button', { name: /^Lihat transaksi Kopi dari bukti/ }).click();
  await expect(page.getByAltText('Bukti Kopi dari bukti')).toBeVisible();
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await uploadProof(page);
  await page.locator('.upload-zone input').setInputFiles(file);
  await expect(page.getByRole('alert')).toContainText('Bukti ini sudah tercatat');
  await page.getByRole('button', { name: 'Tutup dialog' }).click();
  await navigate(page, 'Pengaturan');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh cadangan lengkap' }).click();
  const backupPath = await (await downloadPromise).path();
  const { readFile } = await import('node:fs/promises');
  const backup = JSON.parse(await readFile(backupPath!, 'utf8'));
  expect(backup.receipts).toHaveLength(1);
  expect(backup.receipts[0].data).toBe(data);
  expect(backup.receipts[0].type).toBe('image/png');
  await page.locator('.file-action input').setInputFiles(backupPath!);
  await expect(page.getByText('Pulihkan 1 transaksi dan 1 rekening?')).toBeVisible();
  await page.getByRole('button', { name: 'Ganti & pulihkan' }).click();
  await expect(page.getByText('Pulihkan 1 transaksi dan 1 rekening?')).toHaveCount(0);
  await navigate(page, 'Transaksi');
  await page.getByRole('button', { name: /^Lihat transaksi Kopi dari bukti/ }).click();
  await expect(page.getByAltText('Bukti Kopi dari bukti')).toBeVisible();
});
test('PDF text extraction proposes amount and source for review', async ({ page }) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await uploadProof(page);
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
  await navigate(page, 'Pengaturan');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh cadangan lengkap' }).click();
  const backup = await downloadPromise;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.locator('.file-action input').setInputFiles(path!);
  await expect(page.getByText('Pulihkan 0 transaksi dan 1 rekening?')).toBeVisible();
  await page.getByRole('button', { name: 'Ganti & pulihkan' }).click();
  await expect(page.getByText('Pulihkan 0 transaksi dan 1 rekening?')).toHaveCount(0);
  await navigate(page, 'Ringkasan');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page.getByText('Rp 5.000.000', { exact: true }).first()).toBeVisible();
  await context.setOffline(false);
});

test('advanced category and amount filters combine and reset correctly', async ({ page }) => {
  await page.goto('/');
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Filter lanjutan', exact: true }).click();
  await expect(page.getByText('Semua bulan', { exact: true })).toBeVisible();
  const month = today().slice(0, 7);
  await page.getByLabel('Filter bulan', { exact: true }).fill(month);
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(
    demoStore().transactions.filter((t) => t.date.startsWith(month)).length,
  );
  await page.getByRole('button', { name: 'Hapus filter bulan', exact: true }).click();
  await expect(page.getByText('Semua bulan', { exact: true })).toBeVisible();
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(14);
  await page.getByRole('button', { name: 'Filter kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Kuota & internet' }).click();
  await page.getByLabel('Nominal minimum', { exact: true }).fill('80000');
  await page.getByLabel('Nominal maksimum', { exact: true }).fill('90000');
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: /^Lihat transaksi Paket data Telkomsel/ }),
  ).toBeVisible();
  await page.getByLabel('Nominal minimum', { exact: true }).fill('95000');
  await expect(page.getByRole('alert')).toContainText('minimum tidak boleh melebihi');
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(14);
});

test('quick edit and confirmed delete update balances without duplicating a record', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Edit A good lunch', exact: true }).click();
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('45000');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('75000');
  await page.getByLabel('Nama transaksi').fill('Lunch revisi');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.transactions).toHaveLength(14);
  expect(state.transactions.find((t: { title: string }) => t.title === 'Lunch revisi').amount).toBe(
    75000,
  );
  await page.getByRole('button', { name: 'Hapus Lunch revisi', exact: true }).click();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Lihat transaksi Lunch revisi/ })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus Lunch revisi', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, lanjutkan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.transactions).toHaveLength(13);
  await page.reload();
  await expect(page.getByText('Rp 14.585.010', { exact: true }).first()).toBeVisible();
});

test('category bottom sheet preserves its parent form and supports Escape', async ({ page }) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
  await page.getByLabel('Nama transaksi').fill('Belajar online');
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Nama transaksi')).toHaveValue('Belajar online');
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Pendidikan' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Lihat transaksi Belajar online/ })).toBeVisible();
});

test('reports export actual transactions and appearance survives reload', async ({ page }) => {
  await page.goto('/');
  await navigate(page, 'Laporan');
  await expect(page.getByRole('heading', { name: 'Laporan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tahunan', exact: true }).click();
  await expect(
    page.locator('.report-summary').getByText('Rp 5.200.000', { exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor CSV', exact: true }).click();
  const downloaded = await downloadPromise;
  expect(downloaded.suggestedFilename()).toMatch(/^skysave-laporan-/);
  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printCalled = 'true';
    };
  });
  await page.getByRole('button', { name: 'Cetak / simpan PDF', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-called', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.print-transactions')).toBeVisible();
  await expect(page.locator('.print-transactions tbody tr')).toHaveCount(14);
  await page.emulateMedia({ media: 'screen' });
  await navigate(page, 'Pengaturan');
  await page.getByRole('button', { name: 'Gelap', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('account sheet preserves the form and spends only from the selected wallet', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Transaksi');
  await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
  await page.getByLabel('Nama transaksi').fill('Biaya dari OVO');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('500000');
  await page.getByRole('button', { name: 'Dari rekening', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.getByRole('option', { name: /OVO · Little treats/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Nama transaksi')).toHaveValue('Biaya dari OVO');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Saldo');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('65000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  const created = state.transactions.find((t: { title: string }) => t.title === 'Biaya dari OVO');
  expect(created.accountId).toBe(
    state.accounts.find((a: { provider: string }) => a.provider === 'OVO').id,
  );
  await navigate(page, 'Dompet saya');
  await expect(page.getByText('Rp 302.000', { exact: true }).first()).toBeVisible();
});

test('insight preferences change dashboard content and persist after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.figma-insight-card')).toHaveCount(6);
  await navigate(page, 'Pengaturan');
  const toggle = page.getByRole('switch', { name: 'Saran alokasi dan tabungan' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await navigate(page, 'Ringkasan');
  await expect(page.locator('.figma-insight-card')).toHaveCount(4);
  await page.reload();
  await expect(page.locator('.figma-insight-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Tahunan', exact: true }).click();
  await page
    .getByRole('img', { name: /Grafik total saldo/ })
    .hover({ position: { x: 200, y: 70 } });
  await page.getByRole('button', { name: 'Mingguan', exact: true }).click();
  await expect(page.getByRole('img', { name: /Grafik total saldo/ })).toBeVisible();
  await page.getByRole('button', { name: 'Perbarui insight', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /diperbarui/i })).toBeVisible();
});

test('report filters exclude transfer principal and reject a future reporting date', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Laporan');
  await page.getByRole('button', { name: 'Tahunan', exact: true }).click();
  await page.getByRole('button', { name: 'Transfer', exact: true }).click();
  const summary = page.locator('.report-summary');
  await expect(summary.getByText('Rp 0', { exact: true })).toHaveCount(4);
  await expect(summary.getByText('Rp 1.450.000', { exact: true })).toBeVisible();
  await expect(summary.getByText('2', { exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Ekspor CSV', exact: true }).click();
  const file = await (await download).path();
  const { readFile } = await import('node:fs/promises');
  const csv = await readFile(file!, 'utf8');
  expect(csv).toContain('Tabungan dana darurat');
  expect(csv).not.toContain('A good lunch');
  await page.getByLabel('Tanggal laporan').fill('2099-01-01');
  await expect(page.getByRole('alert')).toContainText('tanggal yang valid');
  await expect(page.getByRole('button', { name: 'Ekspor CSV', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Cetak / simpan PDF', exact: true }),
  ).toBeDisabled();
});

test('iPhone layouts and nested forms fit narrow, large and landscape screens', async ({
  page,
}) => {
  await page.goto('/');
  for (const [width, height] of [
    [375, 667],
    [393, 852],
    [430, 932],
    [852, 393],
  ]) {
    await page.setViewportSize({ width, height });
    for (const name of ['Ringkasan', 'Dompet saya', 'Transaksi', 'Laporan', 'Pengaturan']) {
      await navigate(page, name);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} at ${width}px`,
      ).toBeTruthy();
    }
    await navigate(page, 'Transaksi');
    await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
    await page.getByLabel('Nama transaksi').fill('Catatan dengan nama yang panjang untuk diuji');
    await page.getByRole('button', { name: 'Dari rekening', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `account sheet at ${width}px`,
    ).toBeTruthy();
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).last().click();
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  }
});
