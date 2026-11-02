import { useMemo, useState } from 'react';
import {
  UploadCloud,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Heart,
  Wallet,
  RefreshCw,
  PiggyBank,
  TriangleAlert,
  Lightbulb,
  ChartNoAxesCombined,
} from 'lucide-react';
import type { Store } from './domain';
import { totals, allocations, spendingByCategory, balances } from './domain';
import { dashboardPeriods, moneyInsights, periodTransactions } from './analytics';
import type { InsightPreferences } from './preferences';
import type { MoneyInsight } from './analytics';
import { BalanceChart, CashflowChart, SpendingDonut } from './ui';
import { NetCashflowChart } from './DashboardCharts';
import { MoneyAmount } from './MoneyAmount';

type Page = 'overview' | 'accounts' | 'transactions' | 'plan' | 'together';
export default function Dashboard({
  store,
  total,
  onUpload,
  go,
  onReport,
  onStartOwn,
  preferences,
}: {
  store: Store;
  total: number;
  onUpload: () => void;
  go: (page: Page) => void;
  onReport: () => void;
  onStartOwn: () => void;
  preferences: InsightPreferences;
}) {
  const [days, setDays] = useState(30);
  const [visible, setVisible] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [refreshedAt, setRefreshedAt] = useState('');
  const tx = useMemo(
    () => periodTransactions(store.transactions, days),
    [store.transactions, days],
  );
  const sum = totals(tx);
  const plan = allocations(store);
  const spending = spendingByCategory(tx, '');
  const accountBalances = balances(store);
  const sharedAccounts = store.accounts.filter((a) => a.shared);
  const shared = sharedAccounts.reduce((s, a) => s + accountBalances[a.id], 0);
  const insights = useMemo(
    () => moneyInsights(store, days).filter((item) => preferences[item.id]),
    [store, days, refresh, preferences],
  );
  const insightIcon = (item: MoneyInsight) =>
    item.tone === 'warning'
      ? TriangleAlert
      : item.id === 'together'
        ? Wallet
        : item.id === 'spending'
          ? ChartNoAxesCombined
          : Lightbulb;
  const refreshInsights = () => {
    setRefresh((v) => v + 1);
    setRefreshedAt(
      new Intl.DateTimeFormat('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      }).format(new Date()),
    );
  };
  return (
    <div className="figma-dashboard">
      {store.demo && (
        <div className="dashboard-demo-mobile">
          <span>Mode demo</span>
          <button onClick={onStartOwn}>
            Mulai dengan data saya
            <ArrowRight size={13} />
          </button>
        </div>
      )}
      <header className="figma-dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Your financial overview</p>
        </div>
        <div className="dashboard-header-actions">
          <button className="btn primary" aria-label="Unggah bukti" onClick={onUpload}>
            <UploadCloud size={21} />
            <span>Unggah bukti</span>
          </button>
        </div>
        <div className="figma-period-control" role="group" aria-label="Periode dashboard">
          {dashboardPeriods.map((period) => (
            <button
              key={period.days}
              aria-pressed={days === period.days}
              className={days === period.days ? 'selected' : ''}
              onClick={() => setDays(period.days)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </header>
      <div className="figma-metrics-layout">
        <section className="figma-balance-card" aria-label="Saldo seluruh akun">
          <div className="figma-balance-heading">
            <span>Saldo seluruh akun</span>
            <div>
              <span className="figma-wallet-count">
                <Wallet size={12} />
                {store.accounts.length} dompet
              </span>
              <button
                aria-label={visible ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
                onClick={() => setVisible(!visible)}
              >
                {visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </button>
            </div>
          </div>
          <strong className="figma-balance-amount">
            {visible ? <MoneyAmount value={total} /> : 'Rp ••••••••'}
          </strong>
          <dl className="figma-balance-breakdown">
            <div>
              <dt>Pribadi</dt>
              <dd>{visible ? <MoneyAmount value={plan.personal} /> : '••••••'}</dd>
            </div>
            <div>
              <dt>Bersama</dt>
              <dd>{visible ? <MoneyAmount value={shared} /> : '••••••'}</dd>
            </div>
          </dl>
          <button className="figma-manage-wallets" onClick={() => go('accounts')}>
            Kelola dompet
            <ArrowUpRight size={16} />
          </button>
        </section>
        <section className="figma-summary-grid" aria-label="Ringkasan keuangan">
          <article className="figma-stat income">
            <div>
              <h2>Pemasukan</h2>
              <span>
                <ArrowDownLeft size={17} />
              </span>
            </div>
            <strong>
              <MoneyAmount value={sum.income} />
            </strong>
            <p>{tx.filter((t) => t.kind === 'income').length} kali uang masuk</p>
          </article>
          <article className="figma-stat expense">
            <div>
              <h2>Pengeluaran</h2>
              <span>
                <ArrowUpRight size={17} />
              </span>
            </div>
            <strong>
              <MoneyAmount value={sum.expense} />
            </strong>
            <p>Dalam periode ini</p>
          </article>
          <article className="figma-stat saving">
            <div>
              <h2>Bisa ditabung</h2>
              <span>
                <PiggyBank size={17} />
              </span>
            </div>
            <strong>
              <MoneyAmount value={plan.saving} />
            </strong>
            <button onClick={() => go('plan')}>
              Alokasi {store.plan.saving}%<ArrowUpRight size={12} />
            </button>
          </article>
          <article className="figma-stat together">
            <div>
              <h2>Dana bersama</h2>
              <span>
                <Heart size={16} />
              </span>
            </div>
            <strong>
              <MoneyAmount value={shared} />
            </strong>
            <button onClick={() => go('together')}>
              {sharedAccounts.length} akun bersama
              <ArrowUpRight size={12} />
            </button>
          </article>
        </section>
      </div>
      <div className="figma-dashboard-grid">
        <section className="panel figma-chart-panel figma-cashflow">
          <div className="panel-heading">
            <h2>Pemasukan & pengeluaran</h2>
            <button className="text-btn" onClick={onReport}>
              Laporan
              <ArrowUpRight size={14} />
            </button>
          </div>
          <CashflowChart transactions={tx} days={days} />
        </section>
        <section className="panel figma-chart-panel figma-balance-trend">
          <div className="panel-heading">
            <h2>Tren saldo</h2>
            <span className="figma-tiny-legend">
              <i />
              Seluruh akun
            </span>
          </div>
          <BalanceChart store={store} days={days} />
        </section>
        <section className="panel figma-chart-panel figma-net-trend">
          <div className="panel-heading">
            <h2>Arus dana bersih</h2>
            <span className="figma-tiny-legend">
              <i />
              Selisih
            </span>
          </div>
          <NetCashflowChart transactions={tx} days={days} />
        </section>
        <section className="panel figma-spending">
          <div className="panel-heading">
            <h2>Kategori pengeluaran</h2>
          </div>
          <div className="figma-donut-layout">
            <SpendingDonut entries={spending} compactCenter />
          </div>
        </section>
        <section className="figma-insights" aria-labelledby="sky-insights-title">
          <div className="figma-insights-header">
            <h2 id="sky-insights-title">
              <Sparkles size={21} />
              Sky Insights
            </h2>
            <button aria-label="Perbarui insight" onClick={refreshInsights}>
              <RefreshCw size={14} />
              Perbarui
            </button>
          </div>
          <div className="figma-insight-cards">
            {insights.map((item) => {
              const Icon = insightIcon(item);
              return (
                <article
                  key={item.id}
                  className={`figma-insight-card ${item.tone}`}
                  aria-label={item.title}
                >
                  <span className="figma-insight-icon" aria-hidden="true">
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                  </div>
                </article>
              );
            })}
          </div>
          {refreshedAt && (
            <p className="insights-updated" role="status">
              Insight diperbarui pukul {refreshedAt} dari {tx.length} transaksi pada periode ini.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
