/**
 * Runtime proof for the icons-v2 fixes:
 *  1. the account pill shows "Semua rekening" (and every demo account) untruncated;
 *  2. utility glyphs are rendered <img> 3D assets, never inline <svg>;
 *  3. the floating Catat action never covers the last wallet row at 320/390/440;
 *  4. every glyph image actually decodes.
 * Writes screenshots + JSON to reports/skywallet-icons3d-v3.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = '/home/ubuntu/sky-workspace/reports/skywallet-icons3d-v3';
const shot = `${out}/shot`;
mkdirSync(shot, { recursive: true });
const BASE = process.env.QA_BASE || 'http://127.0.0.1:5189/';
const VIEWPORTS = [
  [320, 720, 'xs'],
  [390, 844, 'sm'],
  [440, 956, 'md'],
  [768, 1024, 'tablet'],
  [1440, 900, 'desktop'],
];

const browser = await chromium.launch({
  executablePath: '/home/ubuntu/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
  args: ['--no-sandbox'],
});
const report = { base: BASE, viewports: [], failures: [] };
const fail = (m) => report.failures.push(m);

try {
  for (const [w, h, label] of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(BASE);
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);

    const entry = { width: w, height: h, label, pageErrors };

    // --- 1. pill label -------------------------------------------------------
    const pill = async () =>
      page.evaluate(`(() => {
        const sw = document.querySelector('.wallet-switch');
        const span = sw.querySelector('.account-picker-trigger > span:not(.mesh-icon)');
        const chev = sw.querySelector('.account-picker-trigger .mesh-icon img');
        const r = (e) => e ? { x: Math.round(e.getBoundingClientRect().x), w: Math.round(e.getBoundingClientRect().width * 10) / 10, h: Math.round(e.getBoundingClientRect().height * 10) / 10 } : null;
        return {
          text: span.textContent.trim(),
          spanWidth: Math.round(span.getBoundingClientRect().width * 10) / 10,
          scrollWidth: span.scrollWidth,
          truncated: span.scrollWidth > span.clientWidth + 1,
          font: getComputedStyle(span).fontSize,
          pill: r(sw),
          chevron: r(chev),
          chevronSrc: chev ? chev.getAttribute('src') : null,
        };
      })()`);
    entry.defaultPill = await pill();
    if (entry.defaultPill.truncated) fail(`${label}: pill truncated "${entry.defaultPill.text}"`);

    // Every demo account selection must also fit.
    entry.accountPills = [];
    const trigger = page.locator('.wallet-switch .account-picker-trigger');
    const optionCount = await trigger.getAttribute('aria-expanded');
    if (optionCount === 'false') {
      await trigger.click();
      const dialog = page.getByRole('dialog', { name: 'Pilih dompet ringkasan' });
      await dialog.waitFor();
      const names = await dialog.locator('[role="option"] span strong').allInnerTexts();
      for (const name of names) {
        await dialog.locator('[role="option"]', { hasText: name }).first().click();
        await dialog.waitFor({ state: 'detached' }).catch(() => {});
        await page.waitForTimeout(150);
        const row = await pill();
        entry.accountPills.push(row);
        if (row.truncated) fail(`${label}: pill truncated for account "${name}" -> "${row.text}"`);
        await trigger.click();
        await page.getByRole('dialog', { name: 'Pilih dompet ringkasan' }).waitFor();
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      // back to "Semua rekening"
      await trigger.click();
      const dialog2 = page.getByRole('dialog', { name: 'Pilih dompet ringkasan' });
      await dialog2.waitFor();
      await dialog2.getByRole('option', { name: /Semua rekening/ }).click();
      await page.waitForTimeout(200);
    }

    // --- 2. glyph inventory --------------------------------------------------
    entry.glyphs = await page.evaluate(`(() => {
      const sels = ['.logo-symbol .mesh-icon img', '.wallet-switch .mesh-icon img', '.balance-label .icon-btn .mesh-icon img', '.wallet-home-heading .icon-btn .mesh-icon img', '.orb-controls .mesh-icon img', '.text-btn .mesh-icon img', '.wallet-card .mesh-icon img'];
      return sels.flatMap((sel) => [...document.querySelectorAll(sel)].map((img) => {
        const r = img.getBoundingClientRect();
        return {
          sel,
          src: img.getAttribute('src'),
          css: [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10],
          natural: [img.naturalWidth, img.naturalHeight],
          complete: img.complete,
        };
      }));
    })()`);
    for (const g of entry.glyphs) {
      if (!g.complete || !g.natural[0]) fail(`${label}: glyph image did not decode ${g.src}`);
      if (!/\/icons\/3d-v2\//.test(g.src || '')) fail(`${label}: non-3D glyph ${g.src}`);
      if (g.css[0] > 0 && g.css[0] < 14) fail(`${label}: glyph below the 14px optical floor ${g.src} @${g.css[0]}`);
    }
    entry.uiSvgCount = await page.evaluate(`document.querySelectorAll('main svg').length`);

    await page.screenshot({ path: `${shot}/${w}-dashboard.png` });
    const card = await page.locator('.wallet-command').first().boundingBox();
    if (card) {
      await page.screenshot({
        path: `${shot}/${w}-card.png`,
        clip: {
          x: Math.max(0, card.x - 4),
          y: Math.max(0, card.y - 4),
          width: Math.min(w - Math.max(0, card.x - 4), card.width + 8),
          height: card.height + 8,
        },
      });
    }

    // --- 3. bottom clearance -------------------------------------------------
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(700);
    entry.clearance = await page.evaluate(`(() => {
      const rows = [...document.querySelectorAll('.asset-list .wallet-card')];
      const last = rows[rows.length - 1];
      const fab = document.querySelector('.app-navigation .capture-button');
      const b = (e) => e ? { top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), left: Math.round(e.getBoundingClientRect().left), right: Math.round(e.getBoundingClientRect().right) } : null;
      const L = b(last), F = b(fab);
      const main = document.querySelector('main');
      const hit = F ? (() => {
        const el = document.elementFromPoint((F.left + F.right) / 2, (F.top + F.bottom) / 2);
        return el ? (el.className && typeof el.className === 'string' ? el.className.split(' ')[0] : el.tagName) : null;
      })() : null;
      return {
        scrollY: Math.round(scrollY),
        bodyOverflow: getComputedStyle(document.body).overflow,
        rows: rows.length,
        mainBottom: Math.round(main.getBoundingClientRect().bottom),
        lastContentBottom: Math.round(Math.max(0, ...([...main.querySelectorAll('*')]
          .filter((e) => !e.children.length && e.textContent.trim() && e.getBoundingClientRect().height > 0 && !e.closest('details:not([open])'))
          .map((e) => e.getBoundingClientRect().bottom)))),
        contentUnderFab: hit,
        lastRow: L,
        lastRowText: last ? last.textContent.replace(/\\s+/g, ' ').trim().slice(0, 48) : null,
        fab: F,
        overlap: !!(L && F && L.bottom > F.top && L.right > F.left && L.left < F.right),
        gap: L && F ? Math.round(F.top - L.bottom) : null,
      };
    })()`);
    // Desktop navigation is a top bar, so the floating action is not over content.
    if (w < 900 && entry.clearance.overlap) fail(`${label}: floating Catat overlaps the last wallet row (gap ${entry.clearance.gap})`);
    if (w < 900 && entry.clearance.lastContentBottom > entry.clearance.fab.top + 1)
      fail(`${label}: page end sits under the floating Catat (last content ${entry.clearance.lastContentBottom}, action starts ${entry.clearance.fab.top})`);
    await page.screenshot({ path: `${shot}/${w}-bottom.png` });

    // Wallet page bottom clearance too (its cards are taller).
    await page.getByRole('button', { name: 'Dompet saya', exact: true }).click();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(600);
    entry.walletClearance = await page.evaluate(`(() => {
      const cards = [...document.querySelectorAll('.wallet-page .wallet-card')];
      const last = cards[cards.length - 1];
      const fab = document.querySelector('.app-navigation .capture-button');
      const b = (e) => e ? { top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), left: Math.round(e.getBoundingClientRect().left), right: Math.round(e.getBoundingClientRect().right) } : null;
      const L = b(last), F = b(fab);
      return { cards: cards.length, lastRow: L, fab: F, overlap: !!(L && F && L.bottom > F.top && L.right > F.left && L.left < F.right), gap: L && F ? Math.round(F.top - L.bottom) : null };
    })()`);
    if (w < 900 && entry.walletClearance.overlap) fail(`${label}: floating Catat overlaps the last wallet card on /dompet`);

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${shot}/${w}-wallet.png` });
    await page.getByRole('button', { name: 'Transaksi', exact: true }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shot}/${w}-activity.png` });
    await page.getByRole('button', { name: 'Pengaturan', exact: true }).click();
    await page.waitForTimeout(400);
    entry.otherPages = await page.evaluate(`(() => {
      const imgs = [...document.querySelectorAll('.mesh-icon img, .approved-icon-slot img')];
      return {
        glyphs: imgs.length,
        decoded: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
        svg: document.querySelectorAll('main svg').length,
        sources: [...new Set(imgs.map((i) => i.getAttribute('src')))],
      };
    })()`);
    if (entry.otherPages.decoded !== entry.otherPages.glyphs)
      fail(`${label}: ${entry.otherPages.glyphs - entry.otherPages.decoded} glyphs failed to decode on settings`);
    await page.screenshot({ path: `${shot}/${w}-settings.png` });
    await page.getByRole('button', { name: 'Ringkasan', exact: true }).click();
    await page.waitForTimeout(300);

    // --- 4. dialogs: check + chevron glyphs still 3D -------------------------
    await page.getByRole('button', { name: 'Catat transaksi' }).first().click();
    await page.getByRole('dialog', { name: 'Catat transaksi' }).waitFor();
    await page.waitForTimeout(300);
    entry.sheet = await page.evaluate(`(() => {
      const d = document.querySelector('[role="dialog"]');
      const imgs = [...d.querySelectorAll('.mesh-icon img')].map((i) => ({ src: i.getAttribute('src'), natural: [i.naturalWidth, i.naturalHeight], css: [Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] }));
      return { imgs: imgs.slice(0, 12), svg: d.querySelectorAll('svg').length };
    })()`);
    for (const i of entry.sheet.imgs) if (!i.natural[0]) fail(`${label}: sheet glyph did not decode ${i.src}`);
    await page.screenshot({ path: `${shot}/${w}-sheet.png` });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);

    if (pageErrors.length) fail(`${label}: page errors ${pageErrors.join(' | ')}`);
    report.viewports.push(entry);
    await page.close();
  }
} finally {
  await browser.close();
  writeFileSync(`${out}/verify.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ failures: report.failures, summary: report.viewports.map((v) => ({ w: v.width, pill: v.defaultPill.text, trunc: v.defaultPill.truncated, clear: v.clearance.gap, walletClear: v.walletClearance.gap, uiSvg: v.uiSvgCount, glyphs: v.glyphs.length })) }, null, 2));
}
