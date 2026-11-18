import { test, expect } from '@playwright/test';
import { emptyStore } from '../../src/domain';

for (const width of [440, 1440]) {
  test(`satin + lifecycle-disabled preview ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [];
    const errors: string[] = [];
    page.on('request', request => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutations.push(request.method() + ' ' + request.url());
    });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/');
    const store = emptyStore();
    store.accounts = [{ id: 'fixture-bca', name: 'Utama', provider: 'BCA', opening: 14001, shared: false, color: '#a78bfa', suffix: '1234' }];
    await page.evaluate(data => localStorage.setItem('skysave.v1', JSON.stringify(data)), store);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible();
    const card = page.locator('.wallet-home > .wallet-command');
    await expect(card.locator('.money-amount')).toHaveAttribute('title', 'Rp 14.001');
    await expect(card).toHaveCSS('background-image', /card-satin-800.webp/);
    await expect(card.locator('.wallet-texture')).toBeHidden();
    await expect(card.locator('.orb-controls button')).toHaveCount(3);
    const geometry = await page.evaluate(() => {
      const card = document.querySelector('.wallet-command')!;
      const rect = card.getBoundingClientRect();
      return { width: rect.width, height: rect.height, viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        icons: [...document.querySelectorAll('.approved-icon-slot--nav')].map(slot => {
          const img = slot.querySelector('img')!;
          const r = img.getBoundingClientRect();
          let clipped = false;
          for (let node: Element | null = slot; node; node = node.parentElement) {
            const style = getComputedStyle(node), b = node.getBoundingClientRect();
            if (/(hidden|clip)/.test(style.overflowX + style.overflowY) && (r.left < b.left || r.right > b.right || r.top < b.top || r.bottom > b.bottom)) clipped = true;
          }
          return { slot: slot.getBoundingClientRect().width, width: r.width, height: r.height, clipped, loaded: img.complete && img.naturalWidth > 0 };
        }) };
    });
    expect(geometry.scrollWidth).toBeLessThanOrEqual(width);
    expect(geometry.icons).toHaveLength(4);
    for (const icon of geometry.icons) expect(icon).toEqual({ slot: 20, width: 32, height: 32, clipped: false, loaded: true });
    if (width === 440) { expect(geometry.width).toBe(400); expect(geometry.height).toBeCloseTo(239.52, 1); }
    await page.screenshot({ path: `/home/ubuntu/sky-workspace/reports/scoped-satin-qa/home-${width}-dpr2.png`, fullPage: true });
    await card.screenshot({ path: `/home/ubuntu/sky-workspace/reports/scoped-satin-qa/card-home-${width}-dpr2.png` });
    await card.getByRole('button', { name: /Tambah dompet/ }).click();
    const provider = page.locator('.provider-picker-trigger > .provider-mark');
    const box = await provider.boundingBox();
    expect(box?.width).toBe(44); expect(box?.height).toBe(44);
    await page.keyboard.press('Escape');
    const nav = page.getByRole('navigation', { name: 'Navigasi utama' });
    await nav.getByRole('button', { name: 'Dompet saya', exact: true }).click();
    const wallet = page.locator('.wallet-slide').first();
    await expect(wallet).toHaveCSS('background-image', /card-satin-800.webp/);
    await expect(wallet.locator('.wallet-texture')).toBeHidden();
    await page.screenshot({ path: `/home/ubuntu/sky-workspace/reports/scoped-satin-qa/wallet-${width}-dpr2.png`, fullPage: true });
    await nav.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    const before = await page.evaluate(() => localStorage.getItem('skysave.v1'));
    for (const [title, phrase] of [['Reset data pribadi', 'RESET'], ['Hapus akun permanen', 'HAPUS AKUN']]) {
      await page.getByRole('button', { name: title, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: title, exact: true });
      await expect(dialog.getByRole('status')).toHaveText('Belum diaktifkan pada preview');
      await dialog.getByLabel('Kata sandi untuk verifikasi ulang').fill('fixture-not-a-real-password');
      await dialog.getByLabel(`Ketik ${phrase}`).fill(phrase);
      await expect(dialog.getByRole('button', { name: title, exact: true })).toBeDisabled();
      // Exercise the form handler directly too: disabled UI is not the only guard.
      await dialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
      await expect(dialog.getByText('Belum diaktifkan pada preview', { exact: true })).toHaveCount(2);
      await page.screenshot({ path: `/home/ubuntu/sky-workspace/reports/scoped-satin-qa/settings-${phrase === 'RESET' ? 'reset' : 'delete'}-${width}-dpr2.png` });
      await dialog.getByRole('button', { name: 'Batal', exact: true }).click();
    }
    expect(await page.evaluate(() => localStorage.getItem('skysave.v1'))).toBe(before);
    expect(mutations).toEqual([]);
    expect(errors).toEqual([]);
    await testInfo.attach('geometry', { body: JSON.stringify({ geometry, provider: box, mutations, errors }, null, 2), contentType: 'application/json' });
  });
}
