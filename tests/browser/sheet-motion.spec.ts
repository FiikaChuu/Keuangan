import { test, expect } from '@playwright/test';

test('mobile header tracks pointer and snaps back below dismissal threshold', async ({ page }) => {
  test.skip(test.info().project.name === 'desktop', 'Mobile-only gesture');
  await page.goto('/');
  await page.getByRole('button', { name: 'Catat transaksi baru', exact: true }).click();
  const sheet = page.getByRole('dialog', { name: 'Catat transaksi', exact: true });
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(400);
  const before = (await sheet.boundingBox())!;
  const handle = (await sheet.locator('.sheet-handle').boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 40, { steps: 8 });
  await expect.poll(async () => (await sheet.boundingBox())!.y - before.y).toBeGreaterThan(30);
  await page.mouse.up();
  await expect
    .poll(async () => Math.abs((await sheet.boundingBox())!.y - before.y))
    .toBeLessThan(2);
  await expect(sheet).toBeVisible();
  expect(
    await sheet.locator('.modal-form-content').evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe('auto');
});
