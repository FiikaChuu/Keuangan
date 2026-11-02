import { useState } from 'react';
import { CalendarDays, Download, FileChartColumn, Printer } from 'lucide-react';
import type { Store, Transaction } from './domain';
import { today, totals, displayDate, money, csv } from './domain';
import { reportRange } from './analytics';
import { downloadFile } from './ui';
import { MoneyAmount } from './MoneyAmount';

export default function Reports({ store }: { store: Store }) {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [date, setDate] = useState(today());
  const [kind, setKind] = useState<'all' | Transaction['kind']>('all');
  const range = reportRange(period, date);
  const tx = store.transactions
    .filter(
      (t) =>
        !range.error &&
        t.date >= range.start &&
        t.date <= range.end &&
        (kind === 'all' || t.kind === kind),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const sum = totals(tx);
  const fees = tx.reduce((s, t) => s + t.fee, 0);
  const moved = tx.filter((t) => t.kind === 'transfer').reduce((s, t) => s + t.amount, 0);
  const summary = [
    { label: 'Pemasukan', value: sum.income, currency: true, tone: 'positive' },
    { label: 'Pengeluaran', value: sum.expense, currency: true, tone: 'negative' },
    {
      label: 'Selisih periode',
      value: sum.income - sum.expense,
      currency: true,
      tone: sum.income >= sum.expense ? 'positive' : 'negative',
    },
    { label: 'Transaksi', value: tx.length, currency: false, tone: '' },
    { label: 'Biaya admin', value: fees, currency: true, tone: 'warning-value' },
    { label: 'Dana dipindahkan', value: moved, currency: true, tone: '' },
  ];
  return (
    <div className="reports-content">
      <section className="report-filters">
        <h2>
          <CalendarDays size={18} />
          PERIODE LAPORAN
        </h2>
        <div className="filter-tabs" role="group" aria-label="Periode laporan">
          {(
            [
              { value: 'week', label: 'Mingguan' },
              { value: 'month', label: 'Bulanan' },
              { value: 'year', label: 'Tahunan' },
            ] as const
          ).map((p) => (
            <button
              key={p.value}
              aria-pressed={period === p.value}
              className={period === p.value ? 'active' : ''}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="filter-field">
          Sampai tanggal
          <input
            aria-label="Tanggal laporan"
            type="date"
            required
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        {range.error && (
          <p className="form-error" role="alert">
            {range.error}
          </p>
        )}
      </section>
      <section className="report-content-filter">
        <h2>ISI LAPORAN</h2>
        <div role="group" aria-label="Isi laporan">
          {(
            [
              ['all', 'Semua'],
              ['income', 'Pemasukan'],
              ['expense', 'Pengeluaran'],
              ['transfer', 'Transfer'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={kind === value}
              className={kind === value ? 'active' : ''}
              onClick={() => setKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>
      <section className="report-summary-section">
        <div className="report-period">
          <h2>
            <FileChartColumn size={17} />
            RINGKASAN {period === 'week' ? 'MINGGUAN' : period === 'month' ? 'BULANAN' : 'TAHUNAN'}
          </h2>
          <p>
            {range.error
              ? 'Periksa tanggal laporan'
              : `${displayDate(range.start)} — ${displayDate(range.end)}`}
          </p>
          {store.demo && <small>Data contoh</small>}
        </div>
        <div className="report-summary">
          {summary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong className={item.tone}>
                {range.error ? (
                  '—'
                ) : item.currency ? (
                  <MoneyAmount value={item.value} />
                ) : (
                  item.value
                )}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <p className="report-explanation">
        Ringkasan mengikuti filter yang dipilih. Transfer antar akun memindahkan dana; biaya admin
        tetap masuk pengeluaran.
      </p>
      <div className="report-actions">
        <button disabled={!!range.error} className="btn primary" onClick={() => window.print()}>
          <Printer size={19} />
          Cetak / simpan PDF
        </button>
        <button
          disabled={!!range.error}
          className="btn secondary"
          onClick={() =>
            downloadFile(
              csv(tx, store.accounts),
              'text/csv;charset=utf-8',
              `skywallet-laporan-${range.start}-${range.end}.csv`,
            )
          }
        >
          <Download size={19} />
          Ekspor CSV
        </button>
      </div>
      <div className="print-transactions">
        <h3>Rincian transaksi</h3>
        <table>
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Transaksi</th>
              <th>Jenis</th>
              <th>Nominal</th>
              <th>Biaya</th>
            </tr>
          </thead>
          <tbody>
            {tx.map((t) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td>
                  {t.title}
                  <small>
                    {store.accounts.find((a) => a.id === t.accountId)?.provider}
                    {t.source ? ` · ${t.source}` : ''}
                  </small>
                </td>
                <td>
                  {t.kind === 'income'
                    ? 'Pemasukan'
                    : t.kind === 'expense'
                      ? 'Pengeluaran'
                      : 'Transfer'}
                </td>
                <td>{money(t.amount)}</td>
                <td>{money(t.fee)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>Dibuat dengan SkyWallet · {displayDate(today())}</p>
      </div>
    </div>
  );
}
