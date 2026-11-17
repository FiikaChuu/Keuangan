import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const demoURL = process.env.REDESIGN_BASE_URL || 'http://127.0.0.1:4185';
const loginURL = process.env.REDESIGN_LOGIN_URL || 'http://127.0.0.1:4186';
const results = [];
try {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const page = await context.newPage();
  // This is a targeted rendered-text check, not a replacement for a full
  // screen-reader/WCAG audit. SVG artwork, disabled controls and hidden text
  // are outside its scope. Transitions are disabled to measure settled colors.
  async function contrast(label) {
    await page.addStyleTag({
      content:
        '*, *::before, *::after { transition: none !important; animation: none !important; }',
    });
    const failures = await page.evaluate(() => {
      const rgba = (value) => value.match(/[\d.]+/g)?.map(Number);
      const luminance = (color) =>
        color
          .slice(0, 3)
          .map((value) => value / 255)
          .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
      const blend = (foreground, background) =>
        foreground
          .slice(0, 3)
          .map(
            (value, index) =>
              value * (foreground[3] ?? 1) + background[index] * (1 - (foreground[3] ?? 1)),
          );
      const background = (element) =>
        element
          ? blend(
              rgba(getComputedStyle(element).backgroundColor),
              background(element.parentElement),
            )
          : [255, 255, 255];
      return [...document.querySelectorAll('body *')]
        .filter(
          (element) =>
            element.getClientRects().length &&
            [...element.childNodes].some(
              (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
            ) &&
            !element.closest('svg, button:disabled, [hidden], [aria-hidden="true"]'),
        )
        .flatMap((element) => {
          const style = getComputedStyle(element);
          const color = rgba(style.color);
          if (!color) return [];
          const surface = background(element);
          const x = luminance(blend(color, surface)),
            y = luminance(surface);
          const ratio = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
          const size = parseFloat(style.fontSize);
          const required =
            size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5;
          return ratio < required
            ? [
                {
                  text: element.textContent.trim().slice(0, 60),
                  ratio: Number(ratio.toFixed(2)),
                  required,
                },
              ]
            : [];
        });
    });
    results.push({ label, failures });
    assert.deepEqual(failures, [], label);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const theme of ['light', 'dark']) {
    await context.addInitScript((theme) => localStorage.setItem('skysave.theme', theme), theme);
    for (const route of [
      '/',
      '/dompet',
      '/expenses',
      '/expenses#laporan',
      '/rencana-uang',
      '/ruang-bersama',
      '/settings',
    ]) {
      await page.goto(`${demoURL}${route}`);
      await page.locator('.app-navigation').waitFor();
      await page.evaluate((theme) => (document.documentElement.dataset.theme = theme), theme);
      await contrast(`${theme} ${route}`);
    }
  }
  await context.close();

  const loginContext = await browser.newContext({ serviceWorkers: 'block' });
  const login = await loginContext.newPage();
  const errors = [];
  login.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await login.setViewportSize({ width, height: 1000 });
    await login.goto(loginURL);
    await login.getByRole('heading', { name: 'Masuk ke SkyWallet', exact: true }).waitFor();
    assert.equal(await login.getByRole('button', { name: 'Masuk', exact: true }).count(), 1);
    assert.equal(
      await login.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await login.screenshot({ path: `test-results/redesign/${width}-login.png`, fullPage: true });
  }
  // Assert loading/error presentation using a local intercepted response only;
  // no credentials or requests are sent to the real Auth service.
  let release;
  const heldResponse = new Promise((resolve) => {
    release = resolve;
  });
  await login.route('**/auth/v1/token?*', async (route) => {
    await heldResponse;
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }),
    });
  });
  await login.getByLabel('Email', { exact: true }).fill('ui-check@example.invalid');
  await login.getByLabel('Kata sandi', { exact: true }).fill('not-a-real-password');
  await login.getByRole('button', { name: 'Masuk', exact: true }).click();
  assert.equal(
    await login.getByRole('button', { name: 'Memproses…', exact: true }).isDisabled(),
    true,
  );
  release();
  await login
    .getByRole('status')
    .filter({ hasText: /Email atau kata sandi tidak cocok/ })
    .waitFor();
  assert.equal(await login.getByRole('button', { name: 'Masuk', exact: true }).isEnabled(), true);
  assert.deepEqual(errors, []);
  await loginContext.close();
  await writeFile(
    'test-results/redesign/accessibility.json',
    JSON.stringify(
      { contrast: results, loginViewports: 4, mockedAuthError: true, pageErrors: errors },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { contrastSurfaces: results.length, loginViewports: 4, mockedAuthError: true, failures: [] },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
