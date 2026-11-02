import type { Store, Transaction } from './domain.ts';
import {
  allocations,
  balances,
  daysAgo,
  money,
  spendingByCategory,
  today,
  totals,
} from './domain.ts';

export const dashboardPeriods = [
  { days: 7, label: 'Mingguan' },
  { days: 30, label: 'Bulanan' },
  { days: 365, label: 'Tahunan' },
] as const;

export function reportRange(period: 'week' | 'month' | 'year', date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today()
  )
    return { start: '', end: '', error: 'Pilih tanggal yang valid, paling lambat hari ini.' };
  if (period === 'week') parsed.setUTCDate(parsed.getUTCDate() - 6);
  const start =
    period === 'month'
      ? `${date.slice(0, 7)}-01`
      : period === 'year'
        ? `${date.slice(0, 4)}-01-01`
        : parsed.toISOString().slice(0, 10);
  return { start, end: date, error: '' };
}

export function periodTransactions(transactions: Transaction[], days: number) {
  return transactions.filter((t) => t.date >= daysAgo(days - 1) && t.date <= today());
}

export function cashflowBuckets(transactions: Transaction[], days: number) {
  const count = days <= 7 ? 7 : 6;
  let cumulative = 0;
  return Array.from({ length: count }, (_, index) => {
    const start = daysAgo(days - 1 - Math.floor((index * days) / count));
    const end = daysAgo(days - Math.floor(((index + 1) * days) / count));
    const sum = totals(transactions.filter((t) => t.date >= start && t.date <= end));
    const net = sum.income - sum.expense;
    cumulative += net;
    return { start, end, ...sum, net, cumulative };
  });
}

export type MoneyInsight = {
  id: 'allocation' | 'spending' | 'together';
  tone: 'accent' | 'warning' | 'coral';
  label: string;
  title: string;
  body: string;
  destination?: 'plan' | 'transactions' | 'together';
};

export function moneyInsights(store: Store, days: number): MoneyInsight[] {
  const tx = periodTransactions(store.transactions, days);
  const sum = totals(tx);
  const plan = allocations(store);
  const spending = spendingByCategory(tx, '');
  const top = spending[0];
  const accountBalances = balances(store);
  const shared = store.accounts
    .filter((a) => a.shared)
    .reduce((s, a) => s + accountBalances[a.id], 0);
  return [
    {
      id: 'allocation',
      tone: plan.shortfall ? 'warning' : 'accent',
      label: 'Rencana',
      title: 'Rencana dana pribadi',
      body: plan.shortfall
        ? `Dana pribadi kurang ${money(plan.shortfall)} dari cadangan wajibmu. Penuhi cadangan sebelum menambah belanja opsional.`
        : `${money(plan.available)} tersedia setelah cadangan wajib. Alokasi tabungan ${store.plan.saving}%: ${money(plan.saving)}.`,
      destination: 'plan',
    },
    {
      id: 'spending',
      tone: 'accent',
      label: 'Pengeluaran',
      title: 'Belanja paling besar',
      body: top
        ? `${top[0]}: ${money(top[1])}, atau ${Math.round((top[1] / sum.expense) * 100)}% dari pengeluaran ${days} hari terakhir.`
        : 'Catat transaksi atau unggah bukti untuk melihat pengeluaran per kategori.',
      destination: 'transactions',
    },
    {
      id: 'together',
      tone: 'coral',
      label: 'Bersama',
      title: 'Saldo akun bersama',
      body: `${money(shared)} tersimpan di catatan akun bersama, terpisah dari alokasi pribadi. Perpindahannya dihitung sebagai transfer.`,
      destination: 'together',
    },
  ];
}
