import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'skysave-offline-shell',
      apply: 'build',
      generateBundle(_, bundle) {
        const assets = Object.keys(bundle)
          .filter((name) => /\.(js|css|woff2)$/.test(name))
          .map((name) => `/${name}`);
        const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
        const source = readFileSync('scripts/sw-template.js', 'utf8')
          .replace('__CACHE_NAME__', `skysave-${version}`)
          .replace(
            '__PRECACHE__',
            JSON.stringify([
              '/',
              '/index.html',
              '/icon.svg',
              '/icon-192.png',
              '/icon-512.png',
              '/icon-maskable.png',
              '/manifest.webmanifest',
              ...assets,
            ]),
          );
        this.emitFile({ type: 'asset', fileName: 'sw.js', source });
      },
    },
  ],
  server: { host: '0.0.0.0' },
  build: { chunkSizeWarningLimit: 1600 },
});
