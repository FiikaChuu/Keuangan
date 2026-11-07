import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  X,
  SlidersHorizontal,
  Download,
  ArrowUpRight,
  CalendarDays,
  FileChartColumn,
  RotateCcw,
  ChevronDown,
  Check,
} from 'lucide-react';
import { DesignIcon } from './design';
import { AnimatedReveal } from './motion';
import type { Store, Transaction } from './domain';
import { money, today, totals, csv, balances, normalizeCategory } from './domain';
import { CategoryPicker, TransactionList, downloadFile, Modal, AccountPicker } from './ui';

const sortOptions = [
  { value: 'newest', label: 'Terbaru dulu' },
  { value: 'oldest', label: 'Terlama dulu' },
  { value: 'largest', label: 'Nominal terbesar' },
] as const;

export default function TransactionsPage({
  store,
  onCreate,
  search,
  setSearch,
  detail,
  onEdit,
  onDelete,
  onReport,
}: {
  store: Store;
  onCreate: () => void;
  search: string;
  setSearch: (s: string) => void;
  detail: (t: Transaction) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
  onReport: () => void;
}) {
  const [kind, setKind] = useState('all');
  const [month, setMonth] = useState('');
  const [account, setAccount] = useState('');
  const [category, setCategory] = useState('');
  const [minimum, setMinimum] = useState('');
  const [maximum, setMaximum] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [sort, setSort] = useState<(typeof sortOptions)[number]['value']>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  useEffect(
    () => setVisibleCount(50),
    [search, kind, month, account, category, minimum, maximum, sort],
  );
  const isAccountSearch = store.accounts.some((a) => a.id === search);
  const validAmount = (s: string) =>
    s === '' || (Number.isSafeInteger(Number(s)) && Number(s) >= 0 && Number(s) <= 1e12);
  const error =
    !validAmount(minimum) || !validAmount(maximum)
      ? 'Rentang nominal harus berupa rupiah utuh antara 0 dan Rp1 triliun.'
      : minimum !== '' && maximum !== '' && Number(minimum) > Number(maximum)
        ? 'Nominal minimum tidak boleh melebihi maksimum.'
        : '';
  const filterCount = [
    category,
    minimum,
    maximum,
    month,
    isAccountSearch ? search : account,
  ].filter(Boolean).length;
  const filtered = store.transactions
    .filter((t) => {
      const a = store.accounts.find((a) => a.id === t.accountId);
      const to = store.accounts.find((a) => a.id === t.toId);
      return (
        !error &&
        (kind === 'all' || t.kind === kind || (kind === 'expense' && t.kind === 'transfer')) &&
        (!month || t.date.startsWith(month)) &&
        (!account || t.accountId === account || t.toId === account) &&
        (!category || normalizeCategory(t.category) === category) &&
        (minimum === '' || t.amount >= Number(minimum)) &&
        (maximum === '' || t.amount <= Number(maximum)) &&
        (isAccountSearch
          ? t.accountId === search || t.toId === search
          : `${t.title} ${t.category} ${t.source} ${t.note} ${t.reference ?? ''} ${a?.provider} ${a?.name} ${to?.name ?? ''}`
              .toLowerCase()
              .includes(search.toLowerCase()))
      );
    })
    .sort((a, b) =>
      sort === 'largest'
        ? b.amount - a.amount
        : sort === 'oldest'
          ? a.date.localeCompare(b.date)
          : b.date.localeCompare(a.date),
    );
  const sum = totals(filtered);
  function reset() {
    setKind('all');
    setMonth('');
    setAccount('');
    setCategory('');
    setMinimum('');
    setMaximum('');
    setSearch('');
  }
  return (
    <>
      <div className="page-heading transactions-heading">
        <div>
          <h1>
            Transaksi
            {store.demo && (
              <span className="ledger-demo" aria-hidden="true">
                Demo
              </span>
            )}
          </h1>
          <p>Riwayat pemasukan dan pengeluaran.</p>
        </div>
        <button
          className="btn primary create-transaction"
          aria-label="Catat transaksi"
          onClick={onCreate}
        >
          <DesignIcon name="plus" />
        </button>
      </div>
      <section className="ledger-panel" aria-label="Riwayat transaksi">
        <div className="ledger-tools">
          <div className="search-field">
            <DesignIcon name="search" />
            <input
              id="transaction-search"
              aria-label="Cari nama, kategori, atau sumber transaksi"
              placeholder="Cari transaksi, kategori, atau sumber…"
              value={isAccountSearch ? '' : search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button aria-label="Hapus pencarian" onClick={() => setSearch('')}>
                <X size={17} />
              </button>
            )}
          </div>
          <button
            className={`filter-toggle ${advanced ? 'active' : ''}`}
            aria-label="Filter lanjutan"
            aria-expanded={advanced}
            aria-controls="advanced-filters"
            onClick={() => setAdvanced(!advanced)}
          >
            <DesignIcon name="filter" />
            {filterCount > 0 && <span>{filterCount}</span>}
          </button>
          <button className="btn secondary ledger-report" onClick={onReport}>
            <FileChartColumn size={18} />
            Laporan
          </button>
        </div>
        <AnimatedReveal open={advanced}>
          <section id="advanced-filters" className="advanced-filters">
            <div className="advanced-heading">
              <h2>
                <SlidersHorizontal size={17} />
                Filter lanjutan
              </h2>
              <button className="text-btn" onClick={reset}>
                <RotateCcw size={13} />
                Reset
              </button>
            </div>
            <div className="filter-tabs" aria-label="Jenis transaksi">
              {[
                ['all', 'Semua'],
                ['expense', 'Pengeluaran'],
                ['income', 'Pemasukan'],
              ].map(([value, label]) => (
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
            <div className="advanced-grid">
              <div className="filter-field">
                <span>Kategori</span>
                <CategoryPicker value={category} onChange={setCategory} allowAll />
              </div>
              <div className="filter-field">
                <span>Rekening</span>
                <AccountPicker
                  label="Filter rekening"
                  accounts={store.accounts}
                  values={balances(store)}
                  allowAll
                  value={isAccountSearch ? search : account}
                  onChange={(value) => {
                    setAccount(value);
                    if (isAccountSearch) setSearch('');
                  }}
                />
              </div>
              <label className="filter-field">
                Nominal minimum (Rp)
                <input
                  aria-label="Nominal minimum"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </label>
              <label className="filter-field">
                Nominal maksimum (Rp)
                <input
                  aria-label="Nominal maksimum"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="Tanpa batas"
                  value={maximum}
                  onChange={(e) => setMaximum(e.target.value)}
                />
              </label>
              <label className="filter-field">
                Bulan transaksi
                <div className={`month-filter ${month ? '' : 'empty'}`}>
                  <CalendarDays size={17} />
                  {!month && <span className="month-placeholder">Semua bulan</span>}
                  <input
                    type="month"
                    aria-label="Filter bulan"
                    max={today().slice(0, 7)}
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                  {month && (
                    <button aria-label="Hapus filter bulan" onClick={() => setMonth('')}>
                      <X size={15} />
                    </button>
                  )}
                </div>
              </label>
              <div className="filter-field filter-explanation">
                <span>Filter yang sesuai kebutuhanmu.</span>
                <p>Nominal memakai nilai transaksi, di luar biaya admin.</p>
              </div>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="ledger-context">
              <span>
                <strong>{filtered.length}</strong> transaksi
                {filterCount || search || kind !== 'all' ? ' ditemukan' : ' tercatat'}
              </span>
              <button
                type="button"
                className="ledger-sort"
                aria-label="Urutan transaksi"
                aria-haspopup="dialog"
                aria-expanded={sortOpen}
                onClick={() => setSortOpen(true)}
              >
                <span>{sortOptions.find((option) => option.value === sort)!.label}</span>
                <ChevronDown size={16} />
              </button>
            </div>
          </section>
        </AnimatedReveal>
        {filterCount > 0 && (
          <div className="active-filter-notice">
            <span>
              {filterCount} filter aktif
              {isAccountSearch ? ` · ${store.accounts.find((a) => a.id === search)?.name}` : ''}
            </span>
            <button onClick={reset}>
              Hapus filter
              <X size={13} />
            </button>
          </div>
        )}
        <div className="transaction-summary">
          <div className="summary-income">
            <span>Pemasukan</span>
            <strong className="positive">{money(sum.income)}</strong>
          </div>
          <div className="summary-expense">
            <span>Pengeluaran</span>
            <strong>{money(sum.expense)}</strong>
          </div>
          <div>
            <span>Selisih dana</span>
            <strong className={sum.income >= sum.expense ? 'positive' : 'negative'}>
              {money(sum.income - sum.expense)}
            </strong>
          </div>
        </div>
        <TransactionList
          store={store}
          transactions={filtered.slice(0, visibleCount)}
          onSelect={detail}
          onEdit={onEdit}
          onDelete={onDelete}
        />
        {filtered.length > visibleCount && (
          <button className="btn secondary" onClick={() => setVisibleCount((count) => count + 50)}>
            Tampilkan 50 berikutnya
          </button>
        )}
        <div className="ledger-footer">
          <p>
            <ArrowUpRight size={14} />
            Transfer antar akun hanya memindahkan saldo. Biaya admin tetap dihitung sebagai
            pengeluaran.
          </p>
          <button
            className="btn secondary"
            onClick={() =>
              downloadFile(
                csv(filtered, store.accounts),
                'text/csv;charset=utf-8',
                `skywallet-transaksi-${today()}.csv`,
              )
            }
          >
            <Download size={16} />
            Ekspor hasil CSV
          </button>
        </div>
      </section>
      <AnimatePresence>
        {sortOpen && (
          <Modal title="Urutkan transaksi" onClose={() => setSortOpen(false)}>
            <div className="category-options" role="listbox" aria-label="Urutan transaksi">
              {sortOptions.map((option) => (
                <button
                  type="button"
                  role="option"
                  key={option.value}
                  aria-selected={sort === option.value}
                  className={sort === option.value ? 'selected' : ''}
                  onClick={() => {
                    setSort(option.value);
                    setSortOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {sort === option.value && <Check size={21} />}
                </button>
              ))}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}
