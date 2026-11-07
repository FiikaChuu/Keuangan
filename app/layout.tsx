import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
const notoSans = localFont({
  src: '../node_modules/@fontsource-variable/noto-sans/files/noto-sans-latin-wght-normal.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-noto',
});
import '../src/app.css';
import '../src/motion-ui.css';
import '../src/reference-ui.css';

export const metadata: Metadata = {
  title: 'SkyWallet — Your money, in balance.',
  description: 'Catatan keuangan pribadi dan bersama.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'SkyWallet', statusBarStyle: 'default' },
  other: { 'apple-mobile-web-app-capable': 'yes' },
  icons: { icon: '/icon.svg', apple: '/icon-192.png' },
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F9F8F6',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={notoSans.variable}>
      <body>{children}</body>
    </html>
  );
}
