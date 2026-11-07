import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) result.push(...(await files(path)));
    else result.push(path);
  }
  return result;
}
const assets = (await files('.next/static'))
  .filter((p) => /\.(js|css|woff2)$/.test(p) && !p.includes('/app/api/'))
  .map((p) => p.replace('.next/', '/_next/'));
const design = (await files('public/design')).map((p) => p.replace('public/', '/'));
const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
const shell = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable.png',
  ...assets,
  ...design,
];
await writeFile(
  'public/sw.js',
  (await readFile('scripts/sw-template.js', 'utf8'))
    .replace('__CACHE_NAME__', `skysave-${version}`)
    .replace('__PRECACHE__', JSON.stringify(shell)),
);
