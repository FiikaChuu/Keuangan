import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
test('provider selector avatars stay square; appearance card removed', async ({ page }, info) => {
  await page.setViewportSize({ width: 440, height: 956 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Dompet saya', exact: true }).click();
  await page.locator('.wallet-add-action').click();
  const trigger = page.getByRole('button', { name: 'Bank atau e-wallet', exact: true });
  await expect(trigger).toBeVisible();
  const check = async () => {
    const sizes = await page.locator('.provider-mark:visible').evaluateAll(els => els.map(el => {
      const box = el.getBoundingClientRect();
      const glyph = el.querySelector('.wallet-glyph')!.getBoundingClientRect();
      return [box.width - box.height, glyph.width - glyph.height];
    }));
    for (const size of sizes) for (const delta of size) expect(Math.abs(delta)).toBeLessThan(1);
  };
  await check();
  await mkdir('output/playwright/compact-ledger', { recursive: true });
  await page.screenshot({ path: `output/playwright/compact-ledger/${info.project.name}-add-wallet-440.png`, fullPage: true });
  await trigger.click();
  await check();
  const names = await page.locator('.provider-options [role=option]').evaluateAll(els => els.map(e => e.getAttribute('aria-label')!));
  for (const name of names) {
    await page.getByRole('option', { name, exact: true }).click();
    await check();
    await trigger.click();
  }
  await page.getByRole('dialog', { name: 'Pilih bank atau e-wallet', exact: true }).getByRole('button', { name: 'Tutup dialog' }).click();
  await page.getByRole('dialog', { name: 'Tambah dompet', exact: true }).getByRole('button', { name: 'Tutup dialog' }).click();
  await page.getByRole('button', { name: 'Pengaturan', exact: true }).click();
  await expect(page.locator('.appearance-settings')).toHaveCount(0);
  await expect(page.locator('.capture-button')).toBeHidden();
  await page.screenshot({ path: `output/playwright/compact-ledger/${info.project.name}-settings-440.png`, fullPage: true });
});
