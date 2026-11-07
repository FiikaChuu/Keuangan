import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { today, demoStore, balances, totals } from '../../src/domain';

async function navigate(page: Page, name: string) {
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
    name: 'Navigasi utama',
  });
  if (['Rencana uang', 'Ruang bersama'].includes(name)) {
    await nav.getByRole('button', { name: 'Dompet saya', exact: true }).click();
    await page.locator('.wallet-tools').getByRole('button', { name, exact: true }).click();
  } else if (name === 'Laporan') {
    await nav.getByRole('button', { name: 'Transaksi', exact: true }).click();
    await page
      .getByRole('group', { name: 'Tampilan transaksi' })
      .getByRole('button', { name: 'Laporan', exact: true })
      .click();
  } else {
    await nav.getByRole('button', { name, exact: true }).click();
  }
}
async function manualTransaction(page: Page) {
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('button', { name: 'Catat transaksi', exact: true })
    .click();
  await expect(page.getByRole('dialog', { name: 'Catat transaksi' })).toBeVisible();
}
async function fillNote(page: Page, note: string) {
  const toggle = page.getByRole('button', { name: /^Detail tambahan/ });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await page.getByLabel('Catatan (opsional)').fill(note);
}
async function selectCategory(page: Page, category: string) {
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await page.getByRole('option', { name: category, exact: true }).click();
}
async function selectAccount(page: Page, label: string, name: RegExp) {
  await page.getByRole('button', { name: label, exact: true }).click();
  await page.getByRole('option', { name }).click();
}
async function ownAccount(page: Page) {
  await page.goto('/');
  await navigate(page, 'Pengaturan');
  await page.getByRole('button', { name: /Mulai dengan data sendiri/ }).click();
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
  await expect(page.getByText('Your financial overview', { exact: true })).toBeVisible();
  await expect(page.locator('.dashboard-header-actions > button')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Unggah bukti', exact: true })).toHaveCount(0);
  await expect(page.locator('.app-shell')).toHaveAttribute('data-demo', 'true');
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
  await manualTransaction(page);
  await page.getByRole('button', { name: 'Pemasukan', exact: true }).last().click();
  await fillNote(page, 'Komisi desain');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('750000');
  await page.getByLabel('Asal pemasukan').fill('Klien tidak tetap');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await manualTransaction(page);
  await fillNote(page, 'Tarik untuk tunai');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('200000');
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Lainnya' }).click();
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Bersama' : 'Ruang bersama');
  await page.getByRole('button', { name: 'Akun bersama', exact: true }).click();
  const initialViewport = page.viewportSize()!;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: initialViewport.width, height: 560 });
  const closeButton = page.getByRole('button', { name: 'Tutup dialog', exact: true });
  const saveWallet = page.getByRole('button', { name: 'Tambahkan dompet', exact: true });
  await saveWallet.click({ trial: true });
  const beforeScroll = {
    close: await closeButton.boundingBox(),
    save: await saveWallet.boundingBox(),
  };
  const fields = page.getByRole('dialog').locator('.modal-form-content');
  await fields.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(await fields.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(closeButton).toBeInViewport();
  await expect(saveWallet).toBeInViewport();
  expect(await closeButton.boundingBox()).toEqual(beforeScroll.close);
  expect(await saveWallet.boundingBox()).toEqual(beforeScroll.save);
  await page.setViewportSize(initialViewport);
  await page.getByLabel('Nama dompet').fill('Tabungan kita');
  await page.getByRole('button', { name: 'Bank atau e-wallet', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.getByRole('option', { name: 'Bank Jago', exact: true }).click();
  await expect(page.getByLabel('Nama dompet')).toHaveValue('Tabungan kita');
  await page.getByLabel('Saldo awal').fill('0');
  await page.getByRole('button', { name: 'Tambahkan dompet', exact: true }).click();
  await page.getByRole('button', { name: 'Catat penambahan dana' }).click();
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('500000');
  await page.getByRole('button', { name: /^Detail tambahan/ }).click();
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
  await expect(page.getByRole('button', { name: /^Lihat transaksi Pemasukan/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Lihat transaksi Lainnya/ })).toHaveCount(0);
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
  await page.getByLabel('Persentase Tabungan').fill('60');
  await page.getByRole('button', { name: 'Simpan rencana', exact: true }).click();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.plan.saving).toBe(60);
  expect(state.plan.fun + state.plan.saving + state.plan.together).toBe(100);
  await page.getByLabel('Kebutuhan wajib yang belum dibayar').fill('6000000');
  await expect(page.getByText(/Dana belum cukup untuk cadangan wajib/)).toBeVisible();
});
test('complete backup, restore confirmation, and offline launch', async ({ page, context }) => {
  await ownAccount(page);
  await navigate(page, 'Pengaturan');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Unduh cadangan lengkap' }).click();
  const backup = await downloadPromise;
  const path = await backup.path();
  expect(path).toBeTruthy();
  const { readFile } = await import('node:fs/promises');
  const legacyBackup = JSON.parse(await readFile(path!, 'utf8'));
  legacyBackup.format = 'skysave-backup';
  await page.locator('.file-action input').setInputFiles({
    name: 'skysave-legacy.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacyBackup)),
  });
  await expect(page.getByText('Pulihkan 0 transaksi dan 1 rekening?')).toBeVisible();
  await page.getByRole('button', { name: 'Pulihkan catatan' }).click();
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
  await page.getByRole('option', { name: 'Tagihan' }).click();
  await page.getByLabel('Nominal minimum', { exact: true }).fill('80000');
  await page.getByLabel('Nominal maksimum', { exact: true }).fill('90000');
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: /^Lihat transaksi Paket data Telkomsel/ }),
  ).toBeVisible();
  await page.getByLabel('Nominal minimum', { exact: true }).fill('95000');
  await expect(page.locator('.form-error[role="alert"]')).toContainText(
    'minimum tidak boleh melebihi',
  );
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(14);
  const sorter = page.getByRole('button', { name: 'Urutan transaksi', exact: true });
  await sorter.click();
  await expect(page.getByRole('dialog', { name: 'Urutkan transaksi' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Terbaru dulu', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('option', { name: 'Terlama dulu', exact: true }).click();
  await expect(sorter).toContainText('Terlama dulu');
  await expect(page.getByRole('button', { name: /^Lihat transaksi/ }).first()).toHaveAccessibleName(
    /Brand identity project/,
  );
  await sorter.click();
  await page.getByRole('option', { name: 'Nominal terbesar', exact: true }).click();
  await expect(sorter).toContainText('Nominal terbesar');
  await expect(page.getByRole('button', { name: /^Lihat transaksi/ }).nth(1)).toHaveAccessibleName(
    /Website landing page/,
  );
  await sorter.click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(sorter).toBeFocused();
  await expect(sorter).toContainText('Nominal terbesar');
});

test('quick edit and confirmed delete update balances without duplicating a record', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await page.getByRole('button', { name: 'Edit A good lunch', exact: true }).click();
  await expect(page.getByLabel('Nominal (Rp)', { exact: true })).toHaveValue('45000');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('75000');
  await fillNote(page, 'Lunch revisi');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  let state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.transactions).toHaveLength(14);
  expect(state.transactions.find((t: { title: string }) => t.title === 'Makan').amount).toBe(75000);
  await page.getByRole('button', { name: 'Hapus Makan', exact: true }).click();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Lihat transaksi Makan/ })).toBeVisible();
  await page.getByRole('button', { name: 'Hapus Makan', exact: true }).click();
  await page.getByRole('button', { name: 'Ya, lanjutkan', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(state.transactions).toHaveLength(13);
  await page.reload();
  await navigate(page, 'Ringkasan');
  await expect(page.getByText('Rp 14.585.010', { exact: true }).first()).toBeVisible();
});

test('category bottom sheet preserves its parent form and supports Escape', async ({ page }) => {
  await ownAccount(page);
  await navigate(page, page.viewportSize()!.width <= 800 ? 'Riwayat' : 'Transaksi');
  await manualTransaction(page);
  await fillNote(page, 'Belajar online');
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Catatan (opsional)')).toHaveValue('Belajar online');
  await page.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Pendidikan' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Lihat transaksi Pendidikan/ })).toBeVisible();
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
  expect(downloaded.suggestedFilename()).toMatch(/^skywallet-laporan-/);
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
  await expect(page.getByRole('heading', { name: 'Pengaturan' })).toBeVisible();
});

test('account sheet preserves the form and spends only from the selected wallet', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Transaksi');
  await manualTransaction(page);
  await fillNote(page, 'Biaya dari OVO');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('500000');
  await page.getByRole('button', { name: 'Dari rekening', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(2);
  await page.getByRole('option', { name: /OVO · Little treats/ }).click();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByLabel('Catatan (opsional)')).toHaveValue('Biaya dari OVO');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.locator('.form-error[role="alert"]')).toContainText('Saldo');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('65000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  const created = state.transactions.find((t: { title: string }) => t.title === 'Makan');
  expect(created.accountId).toBe(
    state.accounts.find((a: { provider: string }) => a.provider === 'OVO').id,
  );
  await navigate(page, 'Dompet saya');
  await expect(page.getByText('Rp 302.000', { exact: true }).first()).toBeVisible();
});

test('insight preferences change dashboard content and persist after reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.figma-insight-card')).toHaveCount(3);
  for (const name of ['Rencana dana pribadi', 'Belanja paling besar', 'Saldo akun bersama']) {
    await expect(page.getByRole('article', { name, exact: true })).toBeVisible();
  }
  await navigate(page, 'Pengaturan');
  await expect(page.locator('.recording-settings, .settings-privacy, .iphone-tip')).toHaveCount(0);
  await expect(page.locator('.settings-content > .settings-section').last()).toHaveClass(
    /insight-preferences/,
  );
  await expect(page.getByRole('button', { name: /^Unduh cadangan lengkap/ })).toBeVisible();
  await expect(page).toHaveTitle(/SkyWallet/);
  await expect(page.locator('.insight-preferences').getByRole('switch')).toHaveCount(3);
  const toggle = page.getByRole('switch', { name: 'Rencana dana pribadi' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await navigate(page, 'Ringkasan');
  await expect(page.locator('.figma-insight-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.figma-insight-card')).toHaveCount(2);
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
  await expect(page.locator('.form-error[role="alert"]')).toContainText('tanggal yang valid');
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
    await manualTransaction(page);
    await fillNote(page, 'Catatan dengan nama yang panjang untuk diuji');
    await page.getByRole('button', { name: 'Dari rekening', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `account sheet at ${width}px`,
    ).toBeTruthy();
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).last().click();
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
  }
});

test('expense category detects transfers for personal and joint sources and conserves balances', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Transaksi');
  await expect(page.getByRole('button', { name: 'Unggah bukti', exact: true })).toHaveCount(0);
  await expect(page.locator('.filter-tabs button')).toHaveCount(0);
  const before = demoStore();
  const beforeBalances = balances(before);
  for (const [source, destination, amount] of [
    [/SeaBank · Daily essentials/, /Bank Jago · Future me/, 125000],
    [/Bank Jago · Our little future/, /SeaBank · Daily essentials/, 75000],
    [/SeaBank · Daily essentials/, /Bank Jago · Our little future/, 50000],
  ] as const) {
    await manualTransaction(page);
    await expect(page.getByLabel('Nama transaksi')).toHaveCount(0);
    await expect(page.locator('.kind-switch button')).toHaveCount(2);
    await selectCategory(page, 'Transfer');
    await expect(
      page.locator('.kind-switch').getByRole('button', { name: 'Pengeluaran', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Ke bank/akun', exact: true })).toBeVisible();
    await selectAccount(page, 'Dari bank/akun', source);
    await page.getByRole('button', { name: 'Ke bank/akun', exact: true }).click();
    await expect(page.getByRole('option', { name: source })).toHaveCount(0);
    await page.getByRole('option', { name: destination }).click();
    await page.getByLabel('Nominal (Rp)', { exact: true }).fill(String(amount));
    await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await page.reload();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  expect(balances(state)).toEqual({
    ...beforeBalances,
    sea: beforeBalances.sea - 100000,
    jago: beforeBalances.jago + 125000,
    shared: beforeBalances.shared - 25000,
  });
  expect(totals(state.transactions)).toEqual(totals(before.transactions));
  const added = state.transactions.filter(
    (t: { id: string }) => !before.transactions.some((old) => old.id === t.id),
  );
  expect(added).toHaveLength(3);
  for (const tx of added)
    expect(tx).toMatchObject({
      title: 'Transfer',
      category: 'Transfer',
      kind: 'transfer',
      note: '',
    });
  await navigate(page, 'Transaksi');
  await page.getByRole('button', { name: 'Filter lanjutan', exact: true }).click();
  await page
    .locator('.filter-tabs')
    .getByRole('button', { name: 'Pengeluaran', exact: true })
    .click();
  await page.getByRole('button', { name: 'Filter kategori', exact: true }).click();
  await page.getByRole('option', { name: 'Transfer', exact: true }).click();
  await expect(page.locator('.card-list .transaction-card')).toHaveCount(5);
});

test('transfer validation and category changes never keep a stale destination or income requirement', async ({
  page,
}) => {
  await page.goto('/');
  await manualTransaction(page);
  await selectCategory(page, 'Transfer');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.locator('.form-error[role="alert"]')).toContainText('Rekening tujuan');
  await selectAccount(page, 'Ke bank/akun', /Bank Jago · Our little future/);
  await selectAccount(page, 'Dari bank/akun', /Bank Jago · Our little future/);
  await expect(page.getByRole('button', { name: 'Ke bank/akun', exact: true })).toHaveText(
    'Pilih rekening',
  );
  await selectAccount(page, 'Ke bank/akun', /SeaBank · Daily essentials/);
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('999999999');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.locator('.form-error[role="alert"]')).toContainText('Saldo');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('100000');
  await page
    .locator('.kind-switch')
    .getByRole('button', { name: 'Pemasukan', exact: true })
    .click();
  await expect(page.getByLabel('Asal pemasukan')).toBeVisible();
  await page
    .locator('.kind-switch')
    .getByRole('button', { name: 'Pengeluaran', exact: true })
    .click();
  await selectCategory(page, 'Pendidikan');
  await expect(page.getByRole('button', { name: 'Ke bank/akun', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  const tx = state.transactions.find((t: { title: string }) => t.title === 'Pendidikan');
  expect(tx).toMatchObject({
    kind: 'expense',
    category: 'Pendidikan',
    accountId: 'shared',
    note: '',
    source: '',
  });
  expect(tx.toId).toBeUndefined();
});

test('editing an old transfer preserves details and recalculates both accounts when its category changes', async ({
  page,
}) => {
  await page.goto('/');
  await navigate(page, 'Transaksi');
  await page.getByRole('button', { name: 'Edit Tabungan dana darurat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pilih kategori', exact: true })).toContainText(
    'Transfer',
  );
  await expect(page.getByRole('button', { name: 'Ke bank/akun', exact: true })).toContainText(
    'Future me',
  );
  await expect(page.getByLabel('Catatan (opsional)')).toHaveValue('Tabungan dana darurat');
  await selectCategory(page, 'Pendidikan');
  await page.getByLabel('Nominal (Rp)', { exact: true }).fill('100000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const before = demoStore();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('skysave.v1')!));
  const old = before.transactions.find((t) => t.title === 'Tabungan dana darurat')!;
  const updated = state.transactions.find((t: { id: string }) => t.id === old.id);
  expect(state.transactions).toHaveLength(before.transactions.length);
  expect(updated).toMatchObject({
    title: 'Pendidikan',
    category: 'Pendidikan',
    kind: 'expense',
    note: 'Tabungan dana darurat',
  });
  expect(updated.toId).toBeUndefined();
  expect(balances(state).sea).toBe(balances(before).sea + old.amount - 100000);
  expect(balances(state).jago).toBe(balances(before).jago - old.amount);
});

test('additional details fit iPhone widths, retain optional notes, and honor reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  for (const width of [320, 375, 393, 430]) {
    await page.setViewportSize({ width, height: 740 });
    await manualTransaction(page);
    const toggle = page.getByRole('button', { name: /^Detail tambahan/ });
    await toggle.click();
    const notes = page.getByLabel('Catatan (opsional)');
    await notes.fill('Makan bersama keluarga');
    await expect(notes).not.toHaveAttribute('required');
    await expect(notes).toHaveCSS('resize', 'none');
    expect(
      await page
        .locator('.modal-form-content')
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBeTruthy();
    const details = await page.locator('.optional-fields').boundingBox();
    const noteBox = await notes.boundingBox();
    expect(noteBox!.x + noteBox!.width).toBeLessThan(details!.x + details!.width - 8);
    expect(noteBox!.y + noteBox!.height).toBeLessThan(details!.y + details!.height - 8);
    await toggle.click();
    await expect(notes).toHaveCount(0);
    await toggle.click();
    await expect(notes).toHaveValue('Makan bersama keluarga');
    await page.getByRole('button', { name: 'Tutup dialog', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

test('opening a sheet preserves focus and the amount already being edited', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await navigate(page, 'Transaksi');
  await page.clock.install();
  // Open and focus in the same task, before the delayed accessibility autofocus.
  await page
    .getByRole('button', { name: 'Edit A good lunch', exact: true })
    .evaluate((button) => button.click());
  const amount = page.getByLabel('Nominal (Rp)', { exact: true });
  await amount.fill('75000');
  await page.clock.runFor(100);
  await expect(amount).toBeFocused();
  await expect(amount).toHaveValue('75000');
  await page.getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('skysave.v1')!).transactions.find(
      (t: { title: string }) => t.title === 'Makan',
    ),
  );
  expect(saved.amount).toBe(75000);
});
