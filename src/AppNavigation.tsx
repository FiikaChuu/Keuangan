import {
  ArrowLeftRight,
  House,
  Settings,
  Plus,
  Wallet,
  ChartNoAxesCombined,
  PiggyBank,
  Heart,
} from 'lucide-react';
import { Logo } from './ui';
export type Page =
  'overview' | 'accounts' | 'transactions' | 'reports' | 'plan' | 'together' | 'settings';
export const pagePaths: Record<Page, string> = {
  overview: '/',
  accounts: '/dompet',
  transactions: '/expenses',
  reports: '/expenses#laporan',
  plan: '/rencana-uang',
  together: '/ruang-bersama',
  settings: '/settings',
};
export function pageFromLocation(): Page {
  const path = location.pathname.replace(/\/$/, '') || '/';
  if (path === '/expenses' && location.hash === '#laporan') return 'reports';
  if (path === '/reports') return 'reports';
  return (Object.entries(pagePaths).find(([, value]) => value === path)?.[0] as Page) ?? 'overview';
}
export default function AppNavigation({
  page,
  go,
  onCapture,
}: {
  page: Page;
  go: (page: Page) => void;
  onCapture: () => void;
}) {
  const active =
    page === 'reports' ? 'transactions' : ['plan', 'together'].includes(page) ? 'accounts' : page;
  const items = [
    { id: 'overview' as const, label: 'Ringkasan', text: 'Beranda', icon: House },
    { id: 'accounts' as const, label: 'Dompet saya', text: 'Dompet', icon: Wallet },
    { id: 'transactions' as const, label: 'Transaksi', text: 'Transaksi', icon: ArrowLeftRight },
    { id: 'settings' as const, label: 'Pengaturan', text: 'Setelan', icon: Settings },
  ];
  return (
    <nav className="app-navigation" aria-label="Navigasi utama">
      <div className="nav-brand">
        <Logo />
        <p>Ruang untuk uangmu.</p>
      </div>
      {items.map((item, index) => (
        <div className={`nav-slot nav-slot-${item.id}`} key={item.id}>
          {index === 2 && (
            <button className="capture-button" aria-label="Catat transaksi" onClick={onCapture}>
              <span>
                <Plus size={23} strokeWidth={1.8} />
              </span>
              <small>Catat</small>
            </button>
          )}
          <button
            className={`nav-link ${active === item.id ? 'mobile-current' : ''}`}
            aria-label={item.label}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={21} strokeWidth={1.8} />
            <small>{item.text}</small>
          </button>
        </div>
      ))}
      <div className="nav-secondary">
        {[
          { id: 'reports' as const, text: 'Laporan', icon: ChartNoAxesCombined },
          { id: 'plan' as const, text: 'Rencana uang', icon: PiggyBank },
          { id: 'together' as const, text: 'Ruang bersama', icon: Heart },
        ].map((item) => (
          <button
            key={item.id}
            className="nav-link"
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={21} strokeWidth={1.8} />
            <small>{item.text}</small>
          </button>
        ))}
      </div>
      <p className="nav-note">
        Catat hari ini.
        <br />
        Rencanakan esok.
      </p>
    </nav>
  );
}
