import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Plus,
  UploadCloud,
  ArrowUpRight,
  ArrowDownLeft,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  Heart,
  Wallet,
  FileChartColumn,
  CalendarDays,
  Leaf,
  ChevronDown,
} from 'lucide-react';
import type { Store, Transaction, Account } from './domain';
import { money, daysAgo, today, totals, allocations, spendingByCategory, balances } from './domain';
import { BalanceChart, CashflowChart, TransactionList, SpendingDonut, EmptyState } from './ui';

type Page = 'overview' | 'accounts' | 'transactions' | 'plan' | 'together';
export default function Dashboard({
  store,
  total,
  onAdd,
  onUpload,
  go,
  detail,
  accountCard,
  onAccount,
  onReport,
}: {
  store: Store;
  total: number;
  onAdd: () => void;
  onUpload: () => void;
  go: (page: Page) => void;
  detail: (tx: Transaction) => void;
  accountCard: (a: Account) => ReactNode;
  onAccount: () => void;
  onReport: () => void;
}) {
  const [days, setDays] = useState(30);
  const [visible, setVisible] = useState(true);
  const [chart, setChart] = useState('balance');
  const tx = store.transactions.filter((t) => t.date >= daysAgo(days - 1) && t.date <= today());
  const sum = totals(tx);
  const plan = allocations(store);
  const spending = spendingByCategory(tx, '');
  const recent = [...store.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const personal = store.accounts.filter((a) => !a.shared);
  const b = balances(store);
  const shared = store.accounts.filter((a) => a.shared).reduce((s, a) => s + b[a.id], 0);
  const top = spending[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A little clarity, every day ✦</span>
          <h1>Lebih tenang, lebih terencana.</h1>
          <p>Ruang kecil untuk uangmu. Langkah besar untuk nanti.</p>
        </div>
        <div className="heading-actions">
          <button className="btn secondary" onClick={onUpload}>
            <UploadCloud size={19} />
            <span>Unggah bukti</span>
          </button>
          <button className="btn primary" onClick={onAdd}>
            <Plus size={21} />
            <span>Catat transaksi</span>
          </button>
        </div>
      </div>
      <div className="overview-period">
        <span>
          <span className="status-dot" />
          Satu pandangan. Semuanya lebih jelas.
        </span>
        <label>
          <CalendarDays size={15} />
          <select
            aria-label="Periode ringkasan"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value="30">30 hari terakhir</option>
            <option value="7">7 hari terakhir</option>
            <option value="90">90 hari terakhir</option>
          </select>
          <ChevronDown size={14} />
        </label>
      </div>
      <div className="summary-grid">
        <section className="total-card">
          <div className="total-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="total-card-top">
            <span>
              <Wallet size={17} />
              Total saldo tercatat
            </span>
            <button
              aria-label={visible ? 'Sembunyikan saldo' : 'Tampilkan saldo'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          <strong className="total-amount">{visible ? money(total) : 'Rp ••••••••'}</strong>
          <div className="total-card-bottom">
            <span>
              <i />
              {store.accounts.length} dompet, satu cerita
            </span>
            <span>skySave ✦</span>
          </div>
        </section>
        <section className="stat-card income">
          <div className="stat-top">
            <span>Pemasukan</span>
            <span className="stat-icon income">
              <ArrowDownLeft size={20} />
            </span>
          </div>
          <strong>{money(sum.income)}</strong>
          <div className="stat-bottom">
            <span>{tx.filter((t) => t.kind === 'income').length} transaksi masuk</span>
            <span>{days} hari terakhir</span>
          </div>
        </section>
        <section className="stat-card expense">
          <div className="stat-top">
            <span>Pengeluaran</span>
            <span className="stat-icon expense">
              <ArrowUpRight size={20} />
            </span>
          </div>
          <strong>{money(sum.expense)}</strong>
          <div className="stat-bottom">
            <span>{tx.filter((t) => t.kind === 'expense').length} transaksi keluar</span>
            <span>Termasuk biaya admin</span>
          </div>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="panel dashboard-chart">
          <div className="panel-heading">
            <div>
              <h2>Perjalanan uangmu</h2>
              <p>Biar pola kecilnya mulai terlihat.</p>
            </div>
            <div className="chart-toggle">
              <button
                className={chart === 'balance' ? 'active' : ''}
                onClick={() => setChart('balance')}
              >
                Saldo
              </button>
              <button className={chart === 'flow' ? 'active' : ''} onClick={() => setChart('flow')}>
                Arus uang
              </button>
            </div>
          </div>
          {chart === 'balance' ? (
            <BalanceChart store={store} days={days} />
          ) : (
            <CashflowChart transactions={tx} days={days} />
          )}
          <div className="chart-footer">
            <span>
              <span className="status-dot" />
              Dari transaksi yang sudah tercatat
            </span>
            <button className="text-btn" onClick={onReport}>
              Lihat laporan
              <ArrowUpRight size={15} />
            </button>
          </div>
        </section>
        <section className="panel dashboard-wallets">
          <div className="panel-heading">
            <h2>
              Dompet kamu<span className="count-badge">{personal.length}</span>
            </h2>
            <button className="icon-btn" aria-label="Tambah dompet" onClick={onAccount}>
              <Plus size={19} />
            </button>
          </div>
          {personal.length ? (
            <div className="wallet-strip">{personal.slice(0, 4).map((a) => accountCard(a))}</div>
          ) : (
            <EmptyState
              icon={<Wallet size={27} />}
              title="Mulai dari dompet pertama"
              text="Tambahkan rekening atau e-wallet yang kamu pakai."
              action={
                <button className="btn primary" onClick={onAccount}>
                  Tambah dompet
                  <Plus size={17} />
                </button>
              }
            />
          )}
          <button className="all-wallets" onClick={() => go('accounts')}>
            Semua dompet
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="panel dashboard-recent">
          <div className="panel-heading">
            <div>
              <h2>Jejak transaksi</h2>
              <p>Hal kecil yang tidak perlu kamu ingat sendiri.</p>
            </div>
            <button className="text-btn" onClick={() => go('transactions')}>
              Lihat semua
              <ArrowRight size={15} />
            </button>
          </div>
          <TransactionList store={store} transactions={recent} onSelect={detail} compact />
        </section>
        <section className="panel dashboard-spending">
          <div className="panel-heading">
            <h2>Uangnya ke mana?</h2>
            <span className="muted-label">{days} hari</span>
          </div>
          <SpendingDonut entries={spending} />
        </section>
        <section className="dashboard-insights">
          <div className="section-title">
            <h2>
              <Sparkles size={20} />
              Sky Insight
            </h2>
            <span className="insight-source">Dari catatanmu</span>
          </div>
          <div className="sky-insight-list">
            <article>
              <span className="insight-icon mint">
                <Leaf size={21} />
              </span>
              <div>
                <span className="insight-label">Ruang untuk bertumbuh</span>
                <h3>
                  {plan.shortfall ? 'Kebutuhan wajib dulu, ya.' : 'Ada ruang untuk masa depan.'}
                </h3>
                <p>
                  {plan.shortfall
                    ? `Dana pribadi masih kurang ${money(plan.shortfall)} dari cadangan kebutuhan yang kamu atur.`
                    : `${money(plan.available)} dana pribadi bisa kamu rencanakan setelah cadangan wajib.`}
                </p>
              </div>
            </article>
            <article>
              <span className="insight-icon coral">
                <ArrowUpRight size={21} />
              </span>
              <div>
                <span className="insight-label">Pola pengeluaran</span>
                <h3>
                  {top ? `${top[0]} paling banyak terpakai.` : 'Kenali kebiasaan, pelan-pelan.'}
                </h3>
                <p>
                  {top
                    ? `${money(top[1])}, sekitar ${Math.round((top[1] / sum.expense) * 100)}% dari pengeluaran ${days} hari ini. Kalau kategori ini dikurangi 10%, ada potensi sisa ${money(Math.floor(top[1] * 0.1))}.`
                    : 'Catat pengeluaranmu untuk melihat kategori yang paling sering menyerap uang.'}
                </p>
              </div>
            </article>
            <button className="shared-insight" onClick={() => go('together')}>
              <span className="insight-icon lavender">
                <Heart size={21} />
              </span>
              <span>
                <strong>Sedikit untuk kita.</strong>
                <small>{money(shared)} di ruang bersama. Lihat cerita kalian.</small>
              </span>
              <ArrowUpRight size={18} />
            </button>
          </div>
        </section>
        <section className="smart-card dashboard-saving">
          <div className="smart-card-top">
            <span className="smart-icon">
              <Sparkles size={19} />
            </span>
            <span>A LITTLE FOR FUTURE YOU</span>
          </div>
          <h2>
            Setiap rupiah
            <br />
            punya tujuan.
          </h2>
          <p>Pemasukan boleh berubah. Rencana baik tetap bisa dibuat.</p>
          <div className="smart-amount">
            <small>
              {plan.shortfall ? 'Kekurangan cadangan wajib' : 'Dana yang bisa kamu atur'}
            </small>
            <strong>{money(plan.shortfall || plan.available)}</strong>
          </div>
          <button onClick={() => go('plan')}>
            Atur rencana uangmu
            <ArrowUpRight size={19} />
          </button>
          <svg
            className="smart-card-flower"
            aria-hidden="true"
            width="150"
            height="150"
            viewBox="0 0 180 180"
          >
            <g stroke="currentColor" strokeWidth="19" strokeLinecap="round">
              <path d="M90 23v134M23 90h134M43 43l94 94M43 137l94-94" />
            </g>
          </svg>
        </section>
      </div>
      <button className="report-shortcut" onClick={onReport}>
        <span>
          <FileChartColumn size={23} />
        </span>
        <div>
          <strong>Gambaran besar, kapan pun kamu butuh.</strong>
          <small>Laporan mingguan, bulanan, dan tahunan. Siap disimpan.</small>
        </div>
        <ArrowRight size={19} />
      </button>
    </>
  );
}
