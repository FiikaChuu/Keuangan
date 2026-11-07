import { ArrowLeftRight, House, Settings, Plus, Wallet } from 'lucide-react';
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
      {items.map((item, index) => (
        <div className="nav-slot" key={item.id}>
          {index === 2 && (
            <button className="capture-button" aria-label="Catat transaksi" onClick={onCapture}>
              <span>
                <Plus size={27} />
              </span>
              <small>Catat</small>
            </button>
          )}
          <button
            aria-label={item.label}
            aria-current={active === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={22} strokeWidth={1.8} />
            <small>{item.text}</small>
          </button>
        </div>
      ))}
    </nav>
  );
}
