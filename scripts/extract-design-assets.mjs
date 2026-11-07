// Preserve the original SVG paths, fills, opacity and gradients. No redraws.
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const sources = {
  categories: 'Expenses · Categories.svg',
  expenses: 'Expenses · iPhone.svg',
  home: 'Home · iPhone.svg',
  settings: 'Settings · iPhone.svg',
  reports: 'Reports · iPhone.svg',
  add: 'Expenses · Add expense.svg',
};
const assets = {
  'status-icons': ['settings', [3, 4, 7, 8, 9], [76, 16]],
  'category-food': ['categories', [88]],
  'category-transport': ['categories', [99]],
  'category-home': ['categories', [122]],
  'category-utilities': ['categories', [136]],
  'category-entertainment': ['categories', [143]],
  'category-health': ['categories', [157]],
  'category-shopping': ['categories', [168]],
  'category-education': ['categories', [188]],
  'category-travel': ['categories', [207]],
  'category-other': ['categories', [217]],
  check: ['categories', [86]],
  plus: ['expenses', [14]],
  search: ['expenses', [18]],
  filter: ['expenses', [24]],
  edit: ['expenses', [62]],
  delete: ['expenses', [67]],
  'ledger-food': ['expenses', [48, 49, 50, 51]],
  close: ['add', [80]],
  chevron: ['add', [169]],
  calendar: ['reports', [14]],
  'report-light': ['reports', [69]],
  'report-dark': ['reports', [77]],
  'nav-home': ['expenses', [200]],
  'nav-home-active': ['home', [298]],
  'nav-wallet': ['expenses', [205]],
  'nav-transactions': ['settings', [103]],
  'nav-transactions-active': ['expenses', [211]],
  'nav-reports': ['expenses', [217]],
  'nav-reports-active': ['reports', [105]],
  'nav-settings': ['expenses', [225]],
  'nav-settings-active': ['settings', [117]],
  'settings-data': ['settings', [19]],
  'settings-notifications': ['settings', [33]],
  'settings-appearance': ['settings', [52]],
  'theme-light': ['settings', [57]],
  'theme-dark': ['settings', [63]],
  'theme-system': ['settings', [69]],
  'settings-warning': ['settings', [78]],
  'delete-light': ['settings', [83]],
  'stat-income': ['home', [31, 32, 33], 26],
  'stat-expense': ['home', [39, 40, 41], 26],
  'stat-saving': ['home', [46, 47, 48], 26],
  insights: ['home', [220, 221, 222]],
  refresh: ['home', [225]],
  'insight-warning': ['home', [233, 234, 235], 33],
  'insight-pattern': ['home', [242, 243, 244], 33],
  'insight-growth': ['home', [251, 252, 253, 254, 255, 256], 33],
  'insight-idea': ['home', [275, 276, 277, 278, 279, 280], 33],
};
await mkdir('public/design', { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  for (const [source, filename] of Object.entries(sources)) {
    await page.setContent(await readFile(`design/references/${filename}`, 'utf8'));
    for (const [name, [file, indices, size = 24]] of Object.entries(assets)) {
      if (file !== source) continue;
      const svg = await page.locator('body > svg').evaluate(
        (root, { indices, size }) => {
          const width = Array.isArray(size) ? size[0] : size;
          const height = Array.isArray(size) ? size[1] : size;
          const all = [...root.querySelectorAll('*')];
          const selected = indices.map((index) => all[index]);
          const boxes = selected.map((node) => node.getBBox());
          const left = Math.min(...boxes.map((b) => b.x));
          const top = Math.min(...boxes.map((b) => b.y));
          const right = Math.max(...boxes.map((b) => b.x + b.width));
          const bottom = Math.max(...boxes.map((b) => b.y + b.height));
          const content = selected.map((node) => node.outerHTML).join('');
          let definitions = '';
          const used = new Set();
          function addDefinitions(text) {
            for (const match of text.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) {
              const id = match[1];
              if (used.has(id)) continue;
              used.add(id);
              const node = root.querySelector(`[id="${id}"]`);
              if (node) {
                definitions += node.outerHTML;
                addDefinitions(node.outerHTML);
              }
            }
          }
          addDefinitions(content);
          return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${(left + right - width) / 2} ${(top + bottom - height) / 2} ${width} ${height}" fill="none">${content}<defs>${definitions}</defs></svg>`;
        },
        { indices, size },
      );
      await writeFile(`public/design/${name}.svg`, svg);
    }
  }
} finally {
  await browser.close();
}
console.log(`Extracted ${Object.keys(assets).length} original SVG assets.`);
