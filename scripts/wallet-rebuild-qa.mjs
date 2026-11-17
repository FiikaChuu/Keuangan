import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.REDESIGN_BASE_URL || 'http://127.0.0.1:4391';
const out = 'test-results/wallet-rebuild';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const checks = [];
try {
 for (const width of [390, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('skysave.theme', 'dark'));
  await page.goto(base);
  await page.locator('.wallet-command').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}/${width}-populated.png`, fullPage: true });
  await page.locator('.wallet-analysis > summary').click();
  await page.screenshot({ path: `${out}/${width}-analysis.png`, fullPage: true });
  await page.evaluate(() => localStorage.setItem('skysave.v1', JSON.stringify({ version:1, demo:false, accounts:[{id:'wallet-one',name:'Dompet saya',provider:'SeaBank',opening:14000,shared:false,color:'#ef7b28',suffix:''}],transactions:[],goals:[],plan:{reserve:0,saving:50,fun:30,together:20} })));
  await page.reload();
  await page.locator('.dashboard-start').waitFor();
  assert.equal(await page.locator('.transaction-card').count(), 0);
  assert.match(await page.locator('.figma-balance-amount').innerText(), /14.000/);
  await page.screenshot({ path: `${out}/${width}-one-wallet-zero-transactions.png`, fullPage: true });
  for (const kind of ['Pengeluaran','Pemasukan','Transfer']) {
   await page.locator('.wallet-quick-actions').getByRole('button', { name:kind,exact:true }).click();
   await page.getByRole('dialog', {name:'Catat transaksi',exact:true}).waitFor();
   if(kind==='Pemasukan') assert.match(await page.locator('.kind-switch .active').innerText(), /Pemasukan/);
   await page.getByRole('button',{name:'Tutup dialog',exact:true}).click();
   await page.getByRole('dialog').waitFor({state:'detached'});
  }
  await page.getByRole('button',{name:'Pilih dompet ringkasan',exact:true}).click();
  await page.getByRole('option',{name:/SeaBank/}).click();
  assert.match(await page.locator('.figma-balance-amount').innerText(), /14.000/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
  checks.push({width,state:'one-wallet-14000-zero-transactions',quickActions:'pass',switcher:'pass'});
  await context.close();
 }
 await writeFile(`${out}/checks.json`, JSON.stringify(checks,null,2));
 console.log(JSON.stringify(checks,null,2));
} finally { await browser.close(); }
