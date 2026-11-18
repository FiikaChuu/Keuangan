import { useEffect, useState } from 'react';
import {
  Plus,
  ChartNoAxesCombined,
  PiggyBank,
  Heart,
} from 'lucide-react';
import { Logo } from './ui';
import { ApprovedIcon } from './ApprovedIcon';
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () =>
      setKeyboardOpen(
        !!viewport &&
          !!document.activeElement?.matches('input, textarea, [contenteditable="true"]') &&
          window.innerHeight - viewport.height > 150,
      );
    viewport?.addEventListener('resize', update);
    update();
    return () => viewport?.removeEventListener('resize', update);
  }, []);
  const active =
    page === 'reports' ? 'transactions' : ['plan', 'together'].includes(page) ? 'accounts' : page;
  const items = [
    { id: 'overview' as const, label: 'Ringkasan', text: 'Beranda', icon: 'home' as const },
    { id: 'accounts' as const, label: 'Dompet saya', text: 'Dompet', icon: 'wallet' as const },
    { id: 'transactions' as const, label: 'Transaksi', text: 'Aktivitas', icon: 'activity' as const },
    { id: 'settings' as const, label: 'Pengaturan', text: 'Setelan', icon: 'settings' as const },
  ];
  return (
    <nav
      className="app-navigation"
      data-keyboard-open={keyboardOpen || undefined}
      aria-label="Navigasi utama"
    >
      <div className="nav-brand">
        <Logo />
      </div>
      <div className="nav-primary">
        {items.map((item) => (
          <button
            key={item.id}
            className={`nav-link ${active === item.id ? 'mobile-current' : ''}`}
            aria-label={item.label}
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <ApprovedIcon name={item.icon} navigation />
            <small>{item.text}</small>
          </button>
        ))}
      </div>
      <div className="nav-secondary">
        {[
          { id: 'reports' as const, text: 'Laporan', icon: ChartNoAxesCombined },
          { id: 'plan' as const, text: 'Rencana', icon: PiggyBank },
          { id: 'together' as const, text: 'Bersama', icon: Heart },
        ].map((item) => (
          <button
            key={item.id}
            className="nav-link"
            aria-current={page === item.id ? 'page' : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={18} />
            <small>{item.text}</small>
          </button>
        ))}
      </div>
      <button className="capture-button" aria-label="Catat transaksi" onClick={onCapture}>
        <span>
          <Plus size={21} />
        </span>
        <small>Catat</small>
      </button>
    </nav>
  );
}
