import { useState } from 'react';
import { CalendarDays, Download, FileChartColumn, Printer, ArrowUpRight } from 'lucide-react';
import type { Store } from './domain';
import { today, totals, spendingByCategory, displayDate, money, csv } from './domain';
import { downloadFile, SpendingDonut } from './ui';

export default function Reports({ store }: { store: Store }) {
  const [period, setPeriod] = useState('30');
  const [date, setDate] = useState(today());
  const effectiveDate =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? date : today();
  const end = effectiveDate;
  const offset = new Date(`${effectiveDate}T12:00:00`);
  offset.setDate(offset.getDate() - 29);
  const start =
    period === 'month'
      ? `${effectiveDate.slice(0, 7)}-01`
      : period === 'year'
        ? `${effectiveDate.slice(0, 4)}-01-01`
        : period === 'week'
          ? (() => {
              const d = new Date(`${effectiveDate}T12:00:00`);
              d.setDate(d.getDate() - 6);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            })()
          : `${offset.getFullYear()}-${String(offset.getMonth() + 1).padStart(2, '0')}-${String(offset.getDate()).padStart(2, '0')}`;
  const tx = store.transactions
    .filter((t) => t.date >= start && t.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date));
  const sum = totals(tx);
  const categories = spendingByCategory(tx, '');
  return (
    <div className="reports-content">
      <div className="report-filters">
        <span className="field-label">
          <CalendarDays size={17} />
          Periode laporan
        </span>
        <div className="filter-tabs">
          {[
            ['week', '7 hari'],
            ['30', '30 hari'],
            ['month', 'Bulanan'],
            ['year', 'Tahunan'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={period === value ? 'active' : ''}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="filter-field">
          Sampai tanggal
          <input
            type="date"
            required
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <div className="report-period">
        <span>
          <FileChartColumn size={17} />
          Ringkasan keuangan
        </span>
        <h3>
          {displayDate(start)} — {displayDate(end)}
        </h3>
        <p>
          {store.demo
            ? 'Laporan berdasarkan data contoh.'
            : 'Laporan berdasarkan transaksi yang sudah kamu catat.'}
        </p>
      </div>
      <div className="report-summary">
        <div>
          <span>Total pemasukan</span>
          <strong className="positive">{money(sum.income)}</strong>
        </div>
        <div>
          <span>Total pengeluaran</span>
          <strong className="negative">{money(sum.expense)}</strong>
        </div>
        <div>
          <span>Selisih dana</span>
          <strong>{money(sum.income - sum.expense)}</strong>
        </div>
        <div>
          <span>Transaksi</span>
          <strong>
            {tx.length}
            <small> tercatat</small>
          </strong>
        </div>
      </div>
      <div className="report-spending">
        <h3>Pengeluaran per kategori</h3>
        <SpendingDonut entries={categories} />
      </div>
      <p className="field-hint">
        <ArrowUpRight size={15} />
        Transfer antar akun tidak dihitung sebagai pemasukan atau pengeluaran. Biaya admin termasuk
        pengeluaran.
      </p>
      <div className="report-actions">
        <button className="btn primary" onClick={() => window.print()}>
          <Printer size={18} />
          Cetak / simpan PDF
        </button>
        <button
          className="btn secondary"
          onClick={() =>
            downloadFile(
              csv(tx, store.accounts),
              'text/csv;charset=utf-8',
              `skysave-laporan-${start}-${end}.csv`,
            )
          }
        >
          <Download size={18} />
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
                <td>{t.title}</td>
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
        <p>Dibuat dengan skySave · {displayDate(today())}</p>
      </div>
    </div>
  );
}
