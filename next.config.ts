import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return ['/dompet', '/expenses', '/reports', '/rencana-uang', '/ruang-bersama', '/settings'].map(
      (source) => ({ source, destination: '/' }),
    );
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      { source: '/manifest.json', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default config;
