import { chromium } from 'playwright';
import { demoStore, emptyStore } from '../src/domain';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = '/home/ubuntu/sky-workspace/reports/skywallet-icons3d-v2/final-shots';
mkdirSync(out, { recursive: true });
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5189/';
const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const report: any = { base: BASE, nav: [], errors: [], broken: [] };
try {
  for (const [w, h, dpr] of [[390, 844, 2], [440, 956, 2], [1440, 900, 1]] as const) {
    for (const state of ['populated', 'empty'] as const) {
      const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
      page.on('pageerror', (e) => report.errors.push(String(e)));
      await page.goto(BASE);
      await page.evaluate((data) => localStorage.setItem('skysave.v1', JSON.stringify(data)), state === 'populated' ? demoStore() : emptyStore());
      await page.reload();
      await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/${w}-${state}-home.png` });
      report.broken.push(...(await page.locator('img').evaluateAll((els) => els.filter((e) => !(e as HTMLImageElement).complete || (e as HTMLImageElement).naturalWidth === 0).map((e) => (e as HTMLImageElement).src))));
      if (w === 440) {
        if (state === 'populated') {
          const nav = await page.locator('.app-navigation').boundingBox();
          if (nav) await page.screenshot({ path: `${out}/440-nav-crop.png`, clip: { x: 0, y: Math.max(0, nav.y - 8), width: 440, height: nav.height + 8 } });
          report.nav.push(await page.evaluate(() => {
            const el = document.querySelector('.app-navigation') as HTMLElement;
            const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
            const slot = el.querySelector('.approved-icon-slot') as HTMLElement;
            const img = el.querySelector('.approved-icon-slot img') as HTMLImageElement;
            const links = [...el.querySelectorAll('.nav-primary .nav-link')].map((n) => n.getBoundingClientRect());
            return { radius: cs.borderTopLeftRadius, borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle}`, position: cs.position, width: r.width, left: r.left, bottom: innerHeight - r.bottom, slot: slot.getBoundingClientRect().width, imgCss: img.getBoundingClientRect().width, imgNatural: [img.naturalWidth, img.naturalHeight], gaps: links.slice(1).map((b, i) => Math.round(b.left - (links[i].left + links[i].width))) };
          }));
          await page.getByRole('button', { name: 'Tambah dompet' }).first().click();
          await page.getByRole('button', { name: 'Bank atau e-wallet' }).click();
          await page.getByRole('dialog', { name: 'Pilih bank atau e-wallet' }).waitFor();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${out}/440-provider-modal-dpr2.png` });
          await page.getByRole('dialog', { name: 'Pilih bank atau e-wallet' }).screenshot({ path: `${out}/440-provider-modal-panel.png` });
          await page.keyboard.press('Escape');
          await page.waitForTimeout(200);
          while (await page.getByRole('button', { name: 'Tutup dialog' }).count()) {
            await page.getByRole('button', { name: 'Tutup dialog' }).first().click();
            await page.waitForTimeout(150);
          }
          await page.getByRole('button', { name: 'Catat transaksi', exact: true }).click();
          await page.getByRole('dialog', { name: 'Catat transaksi' }).waitFor();
          const cat = page.getByRole('button', { name: /Pilih kategori/ });
          if (await cat.count()) await cat.first().click();
          await page.waitForTimeout(250);
          await page.screenshot({ path: `${out}/440-categories.png` });
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
