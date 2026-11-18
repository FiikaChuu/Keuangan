import { test, expect, type Page } from '@playwright/test';
import { demoStore } from '../../src/domain';
import { mkdir } from 'node:fs/promises';

async function fixture(page: Page, extreme = false) {
  await page.goto('/');
  const data = demoStore();
  if (extreme)
    data.accounts = data.accounts.map((a) => ({
      ...a,
      name: 'Dompet kebutuhan keluarga dan tabungan masa depan panjang',
      opening: 1000000000000,
    }));
  await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), data);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Catat transaksi', exact: true });
async function open(page: Page) {
  await page.getByRole('button', { name: 'Catat transaksi baru', exact: true }).click();
  await expect(sheet(page)).toBeVisible();
}
async function exit(page: Page, way: string) {
  if (way === 'escape') await page.keyboard.press('Escape');
  else if (way === 'x') await sheet(page).getByRole('button', { name: 'Tutup dialog' }).click();
  else if (way === 'backdrop')
    await page
      .locator('.modal-overlay')
      .filter({ has: sheet(page) })
      .click({ position: { x: 2, y: 2 } });
  else {
    const box = await sheet(page).locator('.sheet-handle').boundingBox();
    if (!box) throw new Error('Missing handle');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 100, { steps: 8 });
    await page.mouse.up();
  }
}
for (const edit of ['amount', 'date', 'note', 'category', 'account', 'type']) {
  for (const way of ['escape', 'x', 'backdrop', 'drag']) {
    test(`dirty ${edit}: ${way} cancel then accept`, async ({ page }) => {
      test.skip(
        way === 'drag' && test.info().project.name === 'desktop',
        'Mobile-only sheet gesture',
      );
      await fixture(page);
      await open(page);
      const dialog = sheet(page);
      if (edit === 'amount') await dialog.getByLabel('Nominal (Rp)', { exact: true }).fill('12345');
      if (edit === 'date') await dialog.getByLabel('Tanggal', { exact: true }).fill('2025-01-01');
      if (edit === 'note') {
        await dialog.getByRole('button', { name: /^Detail tambahan/ }).click();
        await dialog.getByLabel('Catatan (opsional)').fill('Catatan belum tersimpan');
      }
      if (edit === 'type')
        await dialog.getByRole('button', { name: 'Pemasukan', exact: true }).click();
      if (edit === 'category') {
        await dialog.getByRole('button', { name: 'Pilih kategori', exact: true }).click();
        await page.getByRole('option', { name: 'Belanja', exact: true }).click();
      }
      if (edit === 'account') {
        await dialog.getByRole('button', { name: 'Dari rekening', exact: true }).click();
        await page
          .getByRole('dialog', { name: 'Dari rekening', exact: true })
          .getByRole('option')
          .nth(1)
          .click();
      }
      let confirms = 0;
      const dismiss = async (d: import('@playwright/test').Dialog) => {
        confirms++;
        expect(d.message()).toContain('Buang perubahan');
        await d.dismiss();
      };
      page.on('dialog', dismiss);
      await exit(page, way);
      await expect(dialog).toBeVisible();
      expect(confirms).toBe(1);
      page.off('dialog', dismiss);
      page.once('dialog', async (d) => {
        confirms++;
        await d.accept();
      });
      await exit(page, way);
      await expect(dialog).toHaveCount(0);
      expect(confirms).toBe(2);
    });
  }
}
test('clean exits and successful save bypass guard; body scroll stays native', async ({ page }) => {
  await fixture(page);
  let confirms = 0;
  page.on('dialog', async (d) => {
    confirms++;
    await d.dismiss();
  });
  for (const way of [
    'escape',
    'x',
    'backdrop',
    ...(test.info().project.name === 'desktop' ? [] : ['drag']),
  ]) {
    await open(page);
    await exit(page, way);
    await expect(sheet(page)).toHaveCount(0);
  }
  await open(page);
  await sheet(page).getByLabel('Nominal (Rp)', { exact: true }).fill('1000');
  await sheet(page)
    .getByRole('button', { name: /^Detail tambahan/ })
    .click();
  const body = sheet(page).locator('.modal-form-content');
  await body.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  if (test.info().project.name !== 'desktop')
    expect(await body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await sheet(page).getByRole('button', { name: 'Simpan transaksi', exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
  expect(confirms).toBe(0);
});
test('card geometry and artwork isolation at 320/390/440/1440, carousel resize and reduced motion', async ({
  page,
}) => {
  await fixture(page, true);
  await mkdir('output/playwright/refinement', { recursive: true });
  for (const width of [320, 390, 440, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.locator('.wallet-command').evaluate((el) => {
      const card = el.getBoundingClientRect();
      const art = el.querySelector('.wallet-texture')!.getBoundingClientRect();
      const balance = el.querySelector('.figma-balance-amount')!.getBoundingClientRect();
      const controls = Array.from(el.querySelectorAll('.orb-controls button')).map(
        (b) => b.getBoundingClientRect().top,
      );
      return {
        ratio: card.width / card.height,
        artLeft: art.left,
        balanceRight: balance.right,
        controls,
        width: innerWidth,
        visualWidth: visualViewport!.width,
        scroll: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.ratio).toBeCloseTo(1.67, 1);
    expect(geometry.balanceRight).toBeLessThanOrEqual(geometry.artLeft);
    expect(new Set(geometry.controls).size).toBe(1);
    expect(geometry.scroll).toBeLessThanOrEqual(width);
    expect(geometry.visualWidth).toBeCloseTo(width, 0);
    await page.screenshot({
      path: `output/playwright/refinement/${test.info().project.name}-${width}-extreme.png`,
      fullPage: true,
    });
  }
  await page
    .getByRole('navigation', { name: 'Navigasi utama' })
    .getByRole('button', { name: 'Dompet saya', exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const bars = page.locator('.wallet-carousel-bars button');
  await bars.last().click();
  await expect(bars.last()).toHaveAttribute('aria-current', 'true');
  for (const width of [390, 440, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(bars.last()).toHaveAttribute('aria-current', 'true');
    await expect
      .poll(() =>
        page.locator('.wallet-carousel-rail').evaluate((el) => {
          const last = el.lastElementChild!.getBoundingClientRect();
          return Math.abs(last.left - el.getBoundingClientRect().left);
        }),
      )
      .toBeLessThan(2);
    await page.screenshot({
      path: `output/playwright/refinement/${test.info().project.name}-${width}-wallet.png`,
      fullPage: true,
    });
  }
});
