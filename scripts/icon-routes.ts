import { chromium } from 'playwright';
import { demoStore, emptyStore } from '../src/domain';
import { mkdirSync } from 'node:fs';

const out = '/home/ubuntu/sky-workspace/reports/skywallet-icons3d-v2/final-shots';
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:5189/';
const b = await chromium.launch({ executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'] });
try {
  for (const [w, h, dpr] of [[390, 844, 2], [440, 956, 2], [1440, 900, 1]] as const) {
    const page = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    await page.goto(BASE);
    await page.evaluate((d) => localStorage.setItem('skysave.v1', JSON.stringify(d)), demoStore());
    await page.reload();
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
    for (const [route, label] of [['Dompet saya', 'wallet'], ['Transaksi', 'activity'], ['Pengaturan', 'settings']] as const) {
      await page.getByRole('button', { name: route, exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${w}-populated-${label}.png` });
    }
    await page.getByRole('button', { name: 'Dashboard', exact: true }).click().catch(() => {});
    await page.goto(BASE);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Catat transaksi' }).first().click();
    await page.getByRole('dialog', { name: 'Catat transaksi' }).waitFor();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${w}-populated-form.png` });
    const cat = page.getByRole('button', { name: /Pilih kategori/ });
    if (await cat.count()) {
      await cat.first().click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/${w}-populated-categories.png` });
    }
    await page.close();
  }
} finally { await b.close(); }
