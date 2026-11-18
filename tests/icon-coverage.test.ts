import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveAsset, SIMPLIFIED, aliases } from '../src/MeshIcon';

const root = process.cwd();
const assetDir = join(root, 'public/icons/3d-v2');
const assets = new Set(
  readdirSync(assetDir)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => f.replace(/\.webp$/, '')),
);
const hasAsset = (path: string) =>
  existsSync(join(assetDir, path.split('/icons/3d-v2/')[1] ?? path));

// Recursively collect every UI source file (src/ plus the app/ router shell).
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx|ts|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const uiFiles = walk(join(root, 'src'));
const appFiles = walk(join(root, 'app'));
const tsxFiles = [...uiFiles, ...appFiles].filter((f) => f.endsWith('.tsx'));
const cssFiles = [...uiFiles, ...appFiles].filter((f) => f.endsWith('.css'));
const read = (f: string) => readFileSync(f, 'utf8');
const rel = (f: string) => relative(root, f);

// Inline SVG is only legitimate for non-glyph artwork. Every entry needs a stated
// reason; anything else must be a rendered 3D asset.
const svgAllowlist: Record<string, string> = {
  'src/WalletArt.tsx': 'satin-card print texture (pattern + geometric ornament), aria-hidden decoration',
  'src/DashboardCharts.tsx': 'data visualisation (line/bar series), role=img with aria-label',
  'src/ui.tsx': 'spending donut chart data visualisation, role=img with aria-label',
};

test('no lucide-react glyph imports remain in UI source', () => {
  const offenders = [...tsxFiles, ...uiFiles.filter((f) => f.endsWith('.ts'))]
    .filter((f) => /from ['"]lucide-react['"]/.test(read(f)))
    .map(rel);
  assert.deepEqual(offenders, []);
});

test('inline svg is confined to the documented non-icon allowlist', () => {
  const offenders = tsxFiles.filter((f) => /<svg/.test(read(f)) && !(rel(f) in svgAllowlist)).map(rel);
  assert.deepEqual(offenders, []);
  // Pin counts as well: adding a utility SVG inside a justified file must fail.
  const counts: Record<string, number> = { 'src/WalletArt.tsx': 1, 'src/DashboardCharts.tsx': 3, 'src/ui.tsx': 1 };
  for (const [file, count] of Object.entries(counts)) {
    assert.equal((read(join(root, file)).match(/<svg\b/g) ?? []).length, count, `${file}: new SVG needs explicit justification`);
  }
  // The allowlist must stay honest: every justified file still contains svg.
  for (const file of Object.keys(svgAllowlist)) {
    assert.match(read(join(root, file)), /<svg/, `${file} is allowlisted but draws no svg`);
  }
});

const glyphComponents = new Set(
  [...read(join(root, 'src/MeshIcon.tsx')).matchAll(/export const (\w+) = forwardRef/g)].map((m) => m[1]),
);
const iconNames = new Set<string>();
for (const file of tsxFiles) {
  const text = read(file);
  for (const m of text.matchAll(/<(?:MeshIcon|DesignIcon|WalletGlyph|ApprovedIcon)\b[^>]*\bname=["']([\w-]+)["']/g))
    iconNames.add(m[1]);
  for (const m of text.matchAll(/\bicon:\s*['"]([\w-]+)['"]/g)) iconNames.add(m[1]);
}
const design = read(join(root, 'src/design.tsx'));
for (const m of design.matchAll(/'((?:category|nav|stat|report)-[\w-]+)'/g)) iconNames.add(m[1]);

test('every literal icon name resolves to a rendered 3D webp', () => {
  const missing: string[] = [];
  for (const name of iconNames) {
    const base = aliases[name] ?? name;
    if (!assets.has(base)) missing.push(`${name} -> ${base}.webp`);
  }
  assert.deepEqual(missing, []);
  assert.ok(iconNames.size > 40, `expected a broad icon inventory, saw ${iconNames.size}`);
});

test('small glyphs use the simplified variants and every stated size is shipped', () => {
  const problems: string[] = [];
  let checked = 0;
  for (const file of tsxFiles) {
    const text = read(file);
    for (const m of text.matchAll(/<(\w+)\b[^>]*?\bsize=\{(\d+)\}[^>]*?\/?>/g)) {
      const [, component, rawSize] = m;
      if (!glyphComponents.has(component)) continue;
      const size = Number(rawSize);
      checked += 1;
      if (size < 14) problems.push(`${rel(file)}: ${component} at ${size}px is below the 14px optical floor`);
      const tone = /tone="ink"/.test(m[0]) ? 'ink' : 'default';
      const variant = /variant="sm"/.test(m[0]) ? 'sm' : 'auto';
      const src = resolveAsset(component, size, tone as 'ink' | 'default', variant as 'sm' | 'auto');
      if (!hasAsset(src)) problems.push(`${rel(file)}: ${component}@${size} -> missing ${src}`);
    }
  }
  assert.ok(checked >= 25, `expected a broad glyph inventory, saw ${checked}`);
  assert.deepEqual(problems, []);
});

test('every simplified glyph ships default, ink and ink-sm variants', () => {
  const missing = [...SIMPLIFIED].filter(
    (name) =>
      !hasAsset(`public/icons/3d-v2/sm/${name}.webp`) ||
      !hasAsset(`public/icons/3d-v2/ink/${name}.webp`) ||
      !hasAsset(`public/icons/3d-v2/ink-sm/${name}.webp`),
  );
  assert.deepEqual(missing, []);
});

test('no css filter flattens the 3D artwork into a silhouette', () => {
  const offenders: string[] = [];
  for (const file of cssFiles) {
    const text = read(file);
    for (const rule of text.split('}')) {
      const [selector, body] = rule.split('{');
      if (!selector || !body) continue;
      if (!/\.(design-icon|mesh-icon)|\.approved-icon-slot|\.wallet-glyph/.test(selector)) continue;
      if (/brightness\(\s*0\s*\)|grayscale\(|\binvert\(/.test(body))
        offenders.push(`${rel(file)}: ${selector.trim()}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the account pill cannot be squeezed by its chevron', () => {
  const css = read(join(root, 'src/icons-v2.css'));
  assert.match(css, /\.account-picker-trigger > \.mesh-icon[\s\S]{0,80}flex: 0 0 auto/);
  const labelRule = css.slice(css.indexOf('.wallet-command .account-picker-trigger > span'));
  assert.ok(
    !/text-overflow:\s*ellipsis/.test(labelRule.slice(0, 220)),
    'wallet pill label must not fall back to an ellipsis truncation',
  );
});

test('provider selector, wallet rows and add-wallet form share the 3D provider assets', () => {
  const ui = read(join(root, 'src/ui.tsx'));
  const art = read(join(root, 'src/WalletArt.tsx'));
  const forms = read(join(root, 'src/forms.tsx'));
  assert.match(ui, /ProviderMark/);
  assert.match(forms, /ProviderPicker/);
  assert.match(art, /provider-\$\{slug\}/);
  for (const slug of ['seabank', 'bank-jago', 'bca', 'mandiri', 'bri', 'bni', 'ovo', 'dana', 'gopay', 'shopeepay', 'lainnya']) {
    assert.ok(assets.has(`provider-${slug}`), `missing provider asset ${slug}`);
  }
});

test('asset family size, bytes and alpha remain lightweight', () => {
  assert.ok(assets.size >= 90, `asset count ${assets.size}`);
  const all: string[] = [];
  const collect = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (entry.name.endsWith('.webp')) all.push(full);
    }
  };
  collect(assetDir);
  const total = all.reduce((n, f) => n + statSync(f).size, 0);
  assert.ok(total < 1_200_000, `asset bytes ${total}`);
  assert.ok(existsSync(join(assetDir, 'expense.webp')));
});
