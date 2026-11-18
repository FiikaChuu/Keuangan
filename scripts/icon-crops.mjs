import { chromium } from 'playwright';
const out = '/home/ubuntu/sky-workspace/reports/skywallet-icons3d-v3/crops';
import { mkdirSync } from 'node:fs';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 4 });
await p.goto('http://127.0.0.1:5189/');
await p.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
await p.waitForTimeout(600);
const shots = [
  ['logo', '.logo-symbol'],
  ['header-plus', '.wallet-home-heading .icon-btn'],
  ['pill', '.wallet-switch'],
  ['eye', '.balance-label .icon-btn'],
  ['orb-add', '.orb-add'],
  ['add-wallet', '.orb-controls button:nth-child(2)'],
  ['history', '.orb-controls button:nth-child(3)'],
  ['kelola', '.section-title .text-btn'],
  ['lihat-riwayat', '.wallet-card .wallet-balance small'],
  ['demo-arrow', '.demo-banner button'],
];
for (const [name, sel] of shots) {
  const el = p.locator(sel).first();
  if (await el.count()) {
    await el.screenshot({ path: `${out}/${name}.png` }).catch((e) => console.log('fail', name, String(e).slice(0, 80)));
  } else console.log('missing', name);
}
await b.close();
console.log('done');
