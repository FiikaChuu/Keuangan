import { chromium } from 'playwright';
import { demoStore, emptyStore } from '../src/domain';
import { mkdirSync, writeFileSync } from 'node:fs';

const phase = process.argv[2] || 'after';
const out = `/home/ubuntu/sky-workspace/reports/skywallet-icons3d-v2/${phase}`;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const results: any[] = [];
const BASE = 'http://127.0.0.1:5189/';

try {
  for (const [width, dpr] of [[390, 2], [440, 2], [1440, 1]] as const) {
    const page = await browser.newPage({ viewport: { width, height: 940 }, deviceScaleFactor: dpr });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    for (const state of ['empty', 'populated'] as const) {
      await page.goto(BASE);
      await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), state === 'populated' ? demoStore() : emptyStore());
      await page.reload();
      await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(350);
      for (const route of ['home', 'wallet', 'activity', 'settings'] as const) {
        if (route === 'wallet') await page.getByRole('button', { name: 'Dompet saya', exact: true }).click();
        if (route === 'activity') await page.getByRole('button', { name: 'Transaksi', exact: true }).click();
        if (route === 'settings') await page.getByRole('button', { name: 'Pengaturan', exact: true }).click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: `${out}/${width}-${state}-${route}.png`, fullPage: true });
        results.push({
          width, dpr, state, route,
          brokenImages: await page.locator('img').evaluateAll((els) => els.filter((e) => !(e as HTMLImageElement).complete || (e as HTMLImageElement).naturalWidth === 0).map((e) => (e as HTMLImageElement).src)),
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          errors: [...errors],
        });
      }
      // Capture sheet: bank/provider modal at 440 DPR2, plus wallet-form provider field.
      if (width === 440 && state === 'populated') {
        await page.goto(BASE);
        await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
        await page.getByRole('button', { name: 'Tambah dompet' }).first().click();
        await page.getByRole('button', { name: 'Bank atau e-wallet' }).click();
        await page.getByRole('dialog', { name: 'Pilih bank atau e-wallet' }).waitFor();
        await page.screenshot({ path: `${out}/440-populated-provider-modal.png` });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(250);
        while (await page.getByRole('button', { name: 'Tutup dialog' }).count()) {
          await page.getByRole('button', { name: 'Tutup dialog' }).first().click();
          await page.waitForTimeout(200);
        }
        await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
        await page.getByRole('dialog', { name: 'Catat transaksi' }).waitFor();
        const cat = page.getByRole('button', { name: /Pilih kategori/ });
        if (await cat.count()) await cat.first().click();
        await page.screenshot({ path: `${out}/440-populated-categories.png` });
      }
      if (width === 440 && state === 'empty') {
        await page.goto(BASE);
        await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
        await page.screenshot({ path: `${out}/440-empty-home.png`, fullPage: true });
      }
      await page.goto(BASE);
    }
    const nav = await page.evaluate(() => {
      const el = document.querySelector('.app-navigation') as HTMLElement | null;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const link = el.querySelector('.nav-link') as HTMLElement | null;
      const slot = el.querySelector('.approved-icon-slot') as HTMLElement | null;
      const img = el.querySelector('.approved-icon-slot img') as HTMLImageElement | null;
      return {
        rect: el.getBoundingClientRect().toJSON(),
        radius: cs.borderTopLeftRadius + ' / ' + cs.borderTopRightRadius,
        borderTop: cs.borderTopWidth + ' ' + cs.borderTopStyle,
        position: cs.position,
        linkHeight: link?.getBoundingClientRect().height,
        slot: slot?.getBoundingClientRect().width,
        img: img ? [img.naturalWidth, img.naturalHeight, img.getBoundingClientRect().width] : null,
      };
    });
    results.push({ width, dpr, nav });
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.filter((r) => r.nav || r.brokenImages?.length || r.overflow), null, 2));
}
