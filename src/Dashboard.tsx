import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Plus,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  ChartNoAxesCombined,
  Wallet,
  ReceiptText,
  ChevronRight,
} from 'lucide-react';
import type { Store, Transaction, Account } from './domain';
import { balances, totals, spendingByCategory } from './domain';
import { dashboardPeriods, moneyInsights, periodTransactions } from './analytics';
import type { InsightPreferences } from './preferences';
import { MoneyAmount } from './MoneyAmount';
import { AccountPicker, BalanceChart, CashflowChart, SpendingDonut, TransactionList } from './ui';
import { NetCashflowChart } from './DashboardCharts';

type Page = 'overview' | 'accounts' | 'transactions' | 'plan' | 'together';
export default function Dashboard({
  store,
  total,
  go,
  detail,
  accountCard,
  onAccount,
  onReport,
  onCapture,
  preferences,
}: {
  store: Store;
  total: number;
  go: (page: Page) => void;
  detail: (tx: Transaction) => void;
  accountCard: (a: Account) => ReactNode;
  onAccount: () => void;
  onReport: () => void;
  onStartOwn: () => void;
  onCapture: (kind: Transaction['kind'], accountId?: string) => void;
  preferences: InsightPreferences;
}) {
  const [account, setAccount] = useState('');
  const [visible, setVisible] = useState(true);
  const [days, setDays] = useState(30);
  const [refreshedAt, setRefreshedAt] = useState('');
  const values = balances(store);
  const selected = store.accounts.find((a) => a.id === account);
  const scoped = useMemo(
    () =>
      store.transactions.filter((t) => !account || t.accountId === account || t.toId === account),
    [store.transactions, account],
  );
  const tx = periodTransactions(scoped, days);
  const sum = totals(tx);
  const insights = moneyInsights(store, days).filter((item) => preferences[item.id]);
  const recent = [...scoped].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const actions = [
    { label: 'Pengeluaran', icon: ArrowUpRight, action: () => onCapture('expense', account) },
    { label: 'Pemasukan', icon: ArrowDownLeft, action: () => onCapture('income', account) },
    { label: 'Transfer', icon: ArrowLeftRight, action: () => onCapture('transfer', account) },
    { label: 'Laporan', icon: ChartNoAxesCombined, action: onReport },
  ];
  return (
    <div className="figma-dashboard wallet-home">
      <header className="wallet-home-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Semua uangmu, satu tempat.</p>
        </div>
        <button className="icon-btn" aria-label="Tambah dompet" onClick={onAccount}>
          <Plus size={21} />
        </button>
      </header>
      <section className="wallet-command" aria-label="Saldo seluruh akun">
        <div className="wallet-switch">
          <span className="workspace-avatar">
            <Wallet size={21} />
          </span>
          <AccountPicker
            label="Pilih dompet ringkasan"
            accounts={store.accounts}
            values={values}
            value={account}
            allowAll
            onChange={setAccount}
          />
        </div>
        <div className="balance-label">
          <span>{selected ? 'Saldo dompet' : 'Saldo seluruh akun'}</span>
          <button
            className="icon-btn"
            aria-label={visible ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
        </div>
        <strong className="figma-balance-amount">
          {visible ? <MoneyAmount value={selected ? values[selected.id] : total} /> : 'Rp ••••••'}
        </strong>
        <p className="balance-caption">
          {selected ? selected.name : `${store.accounts.length} dompet dalam catatan`}
          <span>Tidak terhubung ke bank</span>
        </p>
        <div className="wallet-quick-actions">
          {actions.map((item) => (
            <button key={item.label} onClick={item.action}>
              <span>
                <item.icon size={23} strokeWidth={1.7} />
              </span>
              <small>{item.label}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="wallet-home-columns">
        <section className="asset-section" aria-label="Dompet saya">
          <div className="section-title">
            <h2>
              Dompet saya <span className="count-badge">{store.accounts.length}</span>
            </h2>
            <button className="text-btn" onClick={() => go('accounts')}>
              Kelola <ChevronRight size={15} />
            </button>
          </div>
          {store.accounts.length ? (
            <div className="asset-list">{store.accounts.map((a) => accountCard(a))}</div>
          ) : (
            <div className="wallet-onboarding">
              <span className="empty-icon">
                <Wallet size={28} />
              </span>
              <h3>Tempat untuk uangmu</h3>
              <p>Tambahkan rekening atau e-wallet dan saldo awalnya.</p>
              <button className="btn primary" onClick={onAccount}>
                <Plus size={17} />
                Tambah dompet pertama
              </button>
            </div>
          )}
          <div className="wallet-destinations">
            <button onClick={() => go('plan')}>
              <span>
                Rencana uang<small>Atur alokasi & tujuan</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <button onClick={() => go('together')}>
              <span>
                Ruang bersama<small>Catatan untuk dana bersama</small>
              </span>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
        <section className="activity-section">
          <div className="section-title">
            <h2>Aktivitas terbaru</h2>
            <button className="text-btn" onClick={() => go('transactions')}>
              Semua <ChevronRight size={15} />
            </button>
          </div>
          {recent.length ? (
            <TransactionList store={store} transactions={recent} onSelect={detail} compact />
          ) : (
            <div className="dashboard-start">
              <span className="empty-icon">
                <ReceiptText size={26} />
              </span>
              <h2>Mulai dari satu catatan.</h2>
              <p>
                Belum ada aktivitas{selected ? ' di dompet ini' : ''}. Catat pemasukan, pengeluaran,
                atau pindai nota di formulir transaksi.
              </p>
              <button className="btn secondary" onClick={() => onCapture('expense', account)}>
                <Plus size={17} />
                Catat sekarang
              </button>
            </div>
          )}
        </section>
      </div>
      {store.transactions.length > 0 && (
        <details className="wallet-analysis">
          <summary>
            <ChartNoAxesCombined size={20} />
            <span>
              Di balik saldomu<small>Arus kas, tren, dan insight</small>
            </span>
            <ChevronRight size={18} />
          </summary>
          <div className="wallet-analysis-body">
            <div className="section-title">
              <h2>Ringkasan keuangan</h2>
              <div className="figma-period-control" role="group" aria-label="Periode dashboard">
                {dashboardPeriods.map((p) => (
                  <button
                    key={p.days}
                    aria-pressed={days === p.days}
                    className={days === p.days ? 'selected' : ''}
                    onClick={() => setDays(p.days)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="wallet-flow">
              <div>
                <span>Pemasukan</span>
                <strong className="positive">
                  <MoneyAmount value={sum.income} />
                </strong>
              </div>
              <div>
                <span>Pengeluaran</span>
                <strong>
                  <MoneyAmount value={sum.expense} />
                </strong>
              </div>
            </div>
            <div className="analysis-charts">
              <section>
                <h3>Pemasukan & pengeluaran</h3>
                <CashflowChart transactions={tx} days={days} />
              </section>
              <section>
                <h3>Tren saldo</h3>
                <BalanceChart store={store} days={days} />
              </section>
              <section>
                <h3>Arus pemasukan & pengeluaran</h3>
                <NetCashflowChart transactions={tx} days={days} />
              </section>
              <section>
                <h3>Kategori pengeluaran</h3>
                <SpendingDonut entries={spendingByCategory(tx, '')} compactCenter />
              </section>
            </div>
            <section className="wallet-insights">
              <div className="section-title">
                <h2>Sky Insights</h2>
                <button
                  className="text-btn"
                  aria-label="Perbarui insight"
                  onClick={() =>
                    setRefreshedAt(
                      new Date().toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }),
                    )
                  }
                >
                  Perbarui
                </button>
              </div>
              {insights.map((item) => (
                <article className="figma-insight-card" key={item.id} aria-label={item.title}>
                  <strong>{item.label}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
              {refreshedAt && (
                <p role="status">
                  Insight diperbarui pukul {refreshedAt} dari {tx.length} transaksi pada periode
                  ini.
                </p>
              )}
            </section>
          </div>
        </details>
      )}
    </div>
  );
}
